import { expect, test } from 'vitest'
import type { Figure } from './figures'
import type { Lesson, LessonItem } from './lesson'
import {
  planSession,
  replayLog,
  replaySession,
  rowFingerprint,
  rowLesson,
  TEACH_BUDGET_MS,
  type RowHistory,
  type SessionLog,
  type SessionPlan,
} from './session'
import { historyOf, lesson, record, runSession, synth, teachPlan, withNarrative } from './session.fixtures'

function stampedRun(l: Lesson, startedAt = 0) {
  const plan = planSession(l, new Map(), startedAt)
  const trials = runSession(l, plan)
  const log: SessionLog = [{ kind: 'start', plan }, ...trials.map((t): SessionLog[number] => ({ kind: 'trial', ...t }))]
  return { plan, trials, log }
}

const edit = (l: Lesson, f: (items: LessonItem[]) => LessonItem[]): Lesson => ({
  ...l,
  items: f(structuredClone(l.items)),
})

const at = (items: LessonItem[], row: number, role: 'model' | 'test') =>
  items.findIndex((it) => it.row === row && (it.set ?? 1) === 1 && it.role === role)

const firmed = (history: RowHistory): number[] => [...history.values()].filter((r) => r.firmed).map((r) => r.row)

const firmedRows = (l: Lesson, log: SessionLog): number[] => firmed(replayLog(l, log).history)

const unstamp = (log: SessionLog): SessionLog =>
  JSON.parse(JSON.stringify(log, (k, v) => (k === 'fp' ? undefined : v))) as SessionLog

test('every planned row is stamped with the fingerprint of the content it serves', () => {
  const l = synth(3, 'mtt')
  const plan = planSession(l, new Map(), 0)
  const rows = plan.blocks.flatMap((b) => b.rows)
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.every((r) => typeof r.fp === 'string' && r.fp.length === 16)).toBe(true)
  for (const b of plan.blocks)
    for (const r of b.rows) expect(r.fp).toBe(rowFingerprint(l, { row: r.row, set: r.set }, b.kind))
  expect(rowFingerprint(l, { row: 1, set: 1 }, 'atom')).not.toBe(rowFingerprint(l, { row: 1, set: 1 }, 'review'))
})

test('pre-decimal-fix corrections cannot be reassigned to the next row during replay', () => {
  const l: Lesson = {
    topic: 'decimal-history',
    source: 'test',
    items: [
      {
        row: 1,
        role: 'test',
        mode: 'frac',
        prompt: 'Evaluate 1/5',
        expected: '1/5',
        demo: 'One fifth',
        frac: { num: null, den: null },
        match: 'value',
      },
      { row: 2, role: 'test', mode: 'typed', prompt: 'Two?', expected: '2', demo: 'Two' },
    ],
  }
  const plan: SessionPlan = {
    startedAt: 0,
    blocks: [
      {
        kind: 'review',
        rows: [
          { row: 1, set: 1, fp: '2522e98a519c853e' },
          { row: 2, set: 1, fp: '6434a6f5124bfea9' },
        ],
        budgetMs: 90000,
      },
    ],
  }
  const trials = ['.2', '1/5', '2'].map((typed, index) => ({ typed, at: index + 1 }))
  const state = replaySession(l, plan, trials)
  expect(state.staleAt).toEqual({ block: 0, index: 0, row: 1, set: 1 })
  expect(state.unreplayed).toBe(3)
  expect(state.blocks[0].outcomes).toEqual([])
  expect(rowFingerprint(l, { row: 2, set: 1 }, 'review')).toBe('6434a6f5124bfea9')
})

test('a fingerprint tracks what grades an answer and ignores what only presents it', () => {
  const l = synth(2, 'mtt')
  const print = (x: Lesson) => rowFingerprint(x, { row: 1, set: 1 }, 'atom')
  const tweak = (f: (it: LessonItem) => void): Lesson =>
    edit(l, (items) => {
      f(items[at(items, 1, 'test')])
      return items
    })
  const base = print(l)

  expect(print(tweak((it) => (it.prompt = 'reworded')))).toBe(base)
  expect(print(tweak((it) => (it.demo = 'redemoed')))).toBe(base)
  const labelled = tweak((it) => (it.figures = [{ kind: 'bar', units: 2, parts: 3, label: 'a' }]))
  const relabelled = tweak((it) => (it.figures = [{ kind: 'bar', units: 2, parts: 3, label: 'b' }]))
  expect(print(labelled)).toBe(print(relabelled))

  expect(print(tweak((it) => (it.expected = 'other')))).not.toBe(base)
  expect(print(tweak((it) => (it.role = 'model')))).not.toBe(base)
  expect(print(tweak((it) => (it.mode = 'frac')))).not.toBe(base)
  expect(print(tweak((it) => (it.set = 2)))).not.toBe(base)
  expect(print(tweak((it) => (it.accept = ['also'])))).not.toBe(base)
  expect(print(tweak((it) => (it.count = 'parts')))).not.toBe(base)

  expect(print(tweak((it) => (it.prompt = 'p 9/2')))).not.toBe(base)
  expect(print(tweak((it) => (it.prompt = 'p 9/2')))).not.toBe(print(tweak((it) => (it.prompt = 'p 5/4'))))
  expect(print(tweak((it) => (it.expr = '1 + 1')))).not.toBe(base)
  expect(print(tweak((it) => (it.frac = { num: '3', den: null })))).not.toBe(
    print(tweak((it) => (it.frac = { num: '4', den: null }))),
  )
  expect(print(tweak((it) => (it.frac = { num: '3', den: null })))).not.toBe(
    print(tweak((it) => (it.frac = { num: null, den: '3' }))),
  )
  expect(print(tweak((it) => (it.prompt = 'which is 9/2')))).toBe(print(tweak((it) => (it.prompt = 'name 9/2'))))

  expect(print(labelled)).not.toBe(base)
  expect(print(tweak((it) => (it.figures = [{ kind: 'bar', units: 2, parts: 4 }])))).not.toBe(
    print(tweak((it) => (it.figures = [{ kind: 'bar', units: 2, parts: 3 }]))),
  )
  expect(print(tweak((it) => (it.figures = [{ kind: 'circle', units: 2, parts: 3 }])))).not.toBe(print(labelled))

  const bar = { kind: 'bar', units: 2, parts: 3 } as const
  const differs = (a: Record<string, unknown>, b: Record<string, unknown> = {}) =>
    expect(print(tweak((it) => (it.figures = [{ ...bar, ...a } as Figure])))).not.toBe(
      print(tweak((it) => (it.figures = [{ ...bar, ...b } as Figure]))),
    )
  differs({ equal: false })
  differs({ orientation: 'vertical' })
  differs({ counted: 2, band: true }, { counted: 2 })
  differs({ bounds: [0.7] })
  differs({ kind: 'grid', parts: 20, columns: 5 }, { kind: 'grid', parts: 20, columns: 4 })
  differs({ kind: 'number-line', unitMarks: 'fractions' }, { kind: 'number-line', unitMarks: 'blank-fractions' })
  differs({ equal: false }, { bounds: [0.7] })

  expect(print(tweak((it) => (it.accept = ['a', 'b'])))).toBe(print(tweak((it) => (it.accept = ['b', 'a']))))

  expect(print(edit(l, (items) => items.filter((_, i) => i !== at(items, 1, 'test'))))).not.toBe(base)
  const swapped = edit(l, (items) => {
    const i = at(items, 1, 'test')
    ;[items[i], items[i + 1]] = [items[i + 1], items[i]]
    return items
  })
  expect(print(swapped)).not.toBe(base)
})

test.each<[string, (items: LessonItem[]) => LessonItem[]]>([
  [
    'inserting an item into',
    (items) => {
      const i = at(items, 1, 'test')
      items.splice(i, 0, { ...items[i] })
      return items
    },
  ],
  ['deleting an item from', (items) => items.filter((_, i) => i !== at(items, 1, 'test'))],
  ['correcting an expected answer in', (items) => ((items[at(items, 1, 'test')].expected = 'corrected'), items)],
])('%s a served row is caught, never silently zeroed or used to regrade old trials', (_, change) => {
  const l = synth(3, 'mtt')
  const { log } = stampedRun(l)
  expect(firmedRows(l, log)).toEqual([1, 2, 3])
  const audit = replayLog(edit(l, change), log)
  expect(audit).toMatchObject({
    staleRows: [1],
    droppedRows: [1, 2, 3],
    lostRows: [1, 2, 3],
    unstamped: false,
    unreadableSessions: 0,
  })
  expect(audit.history.get(1)).toBeUndefined()
  expect(audit.droppedTrials).toBeGreaterThan(0)
})

test('deleting a whole row no longer throws the entire history away', () => {
  const l = synth(3, 'mtt')
  const { log } = stampedRun(l)
  const gone = edit(l, (items) => items.filter((x) => x.row !== 1))
  const audit = replayLog(gone, log)
  expect(audit.staleRows).toEqual([1])
  expect(audit.unreadableSessions).toBe(0)
  expect(log.filter((e) => e.kind === 'trial').length).toBeGreaterThan(0)
})

test('an edit invalidates from the row it touched onward, keeping the rows before it', () => {
  const l = synth(3, 'mtt')
  const { plan, trials, log } = stampedRun(l)
  const late = edit(l, (items) => ((items[at(items, 3, 'test')].expected = 'corrected'), items))
  const audit = replayLog(late, log)
  expect(firmed(audit.history)).toEqual([1, 2])
  expect(audit.staleRows).toEqual([3])
  expect(audit.lostRows).toEqual([3])

  const s = replaySession(late, plan, trials)
  expect(s.staleAt).toEqual({ block: 2, index: 0, row: 3, set: 1 })
  expect(s.blocks[2].cutBy).toBe('stale')
  expect(s.blocks[2].done).toBe(false)
  expect(s.done).toBe(false)
  expect(s.unreplayed).toBeGreaterThan(0)
  const cosmetic = edit(l, (items) => ((items[at(items, 3, 'test')].prompt = 'reworded'), items))
  expect(firmedRows(cosmetic, log)).toEqual([1, 2, 3])
  expect(replayLog(cosmetic, log).staleRows).toEqual([])
})

test('a stale row early in a stack names the later blocks it abandons', () => {
  const l = synth(24, 'mtt')
  const first = stampedRun(l, 0)
  const history = replayLog(l, first.log).history
  const firmedFirst = firmed(history)
  expect(firmedFirst).toEqual([1, 2, 3, 4, 5, 6])

  const plan = planSession(l, history, 500_000)
  expect(plan.blocks[0].kind).toBe('review')
  expect(plan.blocks.some((b) => b.kind === 'atom')).toBe(true)
  const log: SessionLog = [
    ...first.log,
    { kind: 'start', plan },
    ...runSession(l, plan).map((t): SessionLog[number] => ({ kind: 'trial', ...t })),
  ]
  const before = firmedRows(l, log)
  expect(before.length).toBeGreaterThan(firmedFirst.length)

  const head = plan.blocks[0].rows[0]
  const moved = edit(l, (items) => {
    const i = items.findIndex((x) => x.row === head.row && (x.set ?? 1) === head.set && x.role === 'test')
    items[i].expected = 'corrected'
    return items
  })
  const audit = replayLog(moved, log)
  const after = firmed(audit.history)

  expect(after).not.toEqual(before)
  const vanished = before.filter((r) => !after.includes(r))
  expect(vanished.length).toBeGreaterThan(0)
  expect(audit.staleRows).toEqual([head.row])
  for (const row of vanished) expect(audit.lostRows).toContain(row)
  expect(audit.lostRows.length).toBeGreaterThan(0)
})

test('a log with no fingerprint replays as unverified rather than as corrupt', () => {
  const l = synth(3, 'mtt')
  const { log } = stampedRun(l)
  const old = unstamp(log)
  expect(JSON.stringify(old)).not.toContain('fp')

  const asBefore = replayLog(l, old)
  expect(firmed(asBefore.history)).toEqual([1, 2, 3])
  expect(asBefore.unstamped).toBe(true)
  expect(asBefore.staleRows).toEqual([])

  const edits: Lesson[] = [
    edit(l, (items) => ((items[at(items, 1, 'test')].expected = 'corrected'), items)),
    edit(l, (items) => items.filter((_, i) => i !== at(items, 1, 'test'))),
    edit(l, (items) => items.filter((x) => x.row !== 1)),
  ]
  for (const x of edits) expect(replayLog(x, old).unstamped).toBe(true)
  expect(replayLog(edits[2], old).unreadableSessions).toBe(1)
  expect(replayLog(edits[2], old).staleRows).toEqual([])
  expect(replayLog(edits[2], old).droppedRows).toEqual([1, 2, 3])
})

test('one unreadable session never condemns the sessions around it', () => {
  const l = synth(6, 'mtt')
  const a = stampedRun(l, 0)
  const planB = planSession(l, replayLog(l, a.log).history, 500_000)
  const trialsB = runSession(l, planB)
  const log: SessionLog = [
    ...a.log,
    { kind: 'start', plan: planB },
    ...trialsB.map((t): SessionLog[number] => ({ kind: 'trial', ...t })),
  ]
  expect(firmedRows(l, log).length).toBeGreaterThan(3)

  const broken: SessionLog = structuredClone(log)
  const startB = broken.filter((e) => e.kind === 'start')[1] as { plan: SessionPlan }
  startB.plan.blocks[0].rows[0] = { row: 99, set: 1 }
  const audit = replayLog(l, broken)
  expect(audit.unreadableSessions).toBe(1)
  expect(firmed(audit.history)).toEqual([1, 2, 3, 4, 5, 6])
})

test.each<[string, SessionPlan, RegExp]>([
  [
    'from the instruction/testing era',
    {
      startedAt: 500_000,
      blocks: [{ kind: 'instruction', rows: [{ row: 1, set: 1 }], budgetMs: 1000 }],
    } as unknown as SessionPlan,
    /predates one atom/,
  ],
  [
    'exceeding maximum session size',
    {
      startedAt: 500_000,
      blocks: Array.from({ length: 9 }, () => ({ kind: 'atom', rows: [{ row: 1, set: 1 }], budgetMs: 1000 })),
    },
    /predates session grouping/,
  ],
])('a stored plan %s is refused, and the sessions around it keep their history', (_, retired, reason) => {
  const l = synth(3, 'mtt')
  const fresh = stampedRun(l)
  expect(() => replaySession(l, retired, [])).toThrow(reason)
  const audit = replayLog(l, [...fresh.log, { kind: 'start', plan: retired }])
  expect(audit.unreadableSessions).toBe(1)
  expect(firmed(audit.history)).toEqual([1, 2, 3])
})

test('a session can finish with nothing graded, so no first-try share exists', () => {
  const l = synth(1, 'mm')
  const plan: SessionPlan = {
    startedAt: 0,
    blocks: [{ kind: 'atom', rows: [{ row: 1, set: 1 }], budgetMs: TEACH_BUDGET_MS }],
  }
  const s = replaySession(l, plan, runSession(l, plan))
  expect(s.done).toBe(true)
  expect(s.graded).toBe(0)
  expect(s.rightFirstTry).toBe(0)
})

test('a row with nothing a review block can serve is never planned into one', () => {
  const l = edit(synth(6, 'mtt'), (items) => items.filter((it) => !(it.row === 1 && it.role === 'test')))
  expect(rowLesson(l, { row: 1, set: 1 }, 'review').items).toEqual([])
  expect(rowLesson(l, { row: 1, set: 1 }, 'atom').items.length).toBeGreaterThan(0)

  const plan = planSession(l, historyOf(...[1, 2, 3, 4, 5, 6].map((r) => record(r))), 0)
  expect(plan.blocks.every((b) => b.kind === 'review')).toBe(true)
  const rows = plan.blocks.flatMap((b) => b.rows)
  expect(rows.some((r) => r.row === 1)).toBe(false)
  expect(rows.map((r) => r.row)).toEqual([6, 5, 2, 3])
  expect(() => runSession(l, plan)).not.toThrow()
})

test('a row that ships only one instance set is served from the set it has', () => {
  const l = edit(synth(2, 'mtt'), (items) => items.filter((it) => !(it.row === 1 && (it.set ?? 1) === 2)))
  const rows = planSession(l, historyOf(record(1, { firmed: false, timesServed: 1 })), 0).blocks.flatMap((b) => b.rows)
  expect(rows.find((r) => r.row === 1)?.set).toBe(1)
  expect(rows.find((r) => r.row === 2)?.set).toBe(1)
})

test('no plan ever names a row its block kind cannot serve', () => {
  const allRows = [...new Set(lesson.items.map((it) => it.row))]
  const cases: [string, Lesson, RowHistory][] = [
    ['the shipped lesson, first session', lesson, new Map()],
    ['a narrative-led lesson, first session', withNarrative(synth(3, 'mtt')), new Map()],
    ['the shipped lesson, part way in', lesson, historyOf(...[1, 2, 3].map((r) => record(r)))],
    ['the shipped lesson, every row firm', lesson, historyOf(...allRows.map((r) => record(r)))],
    [
      'a model-only row banked firm',
      edit(synth(5, 'mtt'), (items) => items.filter((it) => !(it.row === 3 && it.role === 'test'))),
      historyOf(...[1, 2, 3, 4, 5].map((r) => record(r))),
    ],
    [
      'a single-set row served an odd number of times',
      edit(synth(5, 'mtt'), (items) => items.filter((it) => !(it.row === 4 && (it.set ?? 1) === 2))),
      historyOf(...[1, 2, 3, 4, 5].map((r) => record(r, { timesServed: 1 }))),
    ],
  ]
  const empty: string[] = []
  for (const [what, l, history] of cases) {
    const plan = planSession(l, history, 0)
    expect(plan.blocks.length).toBeGreaterThan(0)
    for (const b of plan.blocks)
      for (const r of b.rows)
        if (rowLesson(l, r, b.kind).items.length === 0) empty.push(`${what}: ${b.kind} row ${r.row} set ${r.set}`)
    expect(() => runSession(l, plan)).not.toThrow()
  }
  expect(empty).toEqual([])
})

test.each([
  [
    'across the stale path',
    () => {
      const l = synth(3, 'mtt')
      const { plan, trials } = stampedRun(l)
      const moved = edit(l, (items) => ((items[at(items, 2, 'test')].expected = 'corrected'), items))
      return { l: moved, plan, trials, staleAt: { block: 1, index: 0, row: 2, set: 1 } }
    },
  ],
  [
    'when a row is missed',
    () => {
      const l = synth(2, 'mtt')
      const plan = teachPlan(0, [1, 2])
      const answer = (it: LessonItem, correction: boolean) =>
        correction || it.expected !== '2 1 1' ? it.expected : 'nope'
      return { l, plan, trials: runSession(l, plan, { answer }), staleAt: null }
    },
  ],
])('replaySession is pure %s: identical outputs, unmutated inputs', (_, setup) => {
  const { l, plan, trials, staleAt } = setup()
  const snapshot = JSON.stringify({ l, plan, trials })
  const a = replaySession(l, plan, trials)
  expect(a).toEqual(replaySession(l, plan, trials))
  expect(a.staleAt).toEqual(staleAt)
  expect(JSON.stringify({ l, plan, trials })).toBe(snapshot)
})
