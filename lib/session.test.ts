import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import type { Figure } from './figures'
import type { Lesson, LessonItem } from './lesson'
import {
  activeMs,
  DEFAULT_SCHEDULE,
  IDLE_CAP_MS,
  NARRATIVE_BUDGET_MS,
  planSession,
  replayLog,
  replaySession,
  REVIEW_BUDGET_MS,
  REVIEW_MAX,
  jumpToRow,
  rowFingerprint,
  rowHistory,
  rowLesson,
  selectReview,
  TEACH_BUDGET_MS,
  type BlockPlan,
  type RowHistory,
  type RowRecord,
  type SessionLog,
  type SessionPlan,
  type Trial,
} from './session'

const lesson = JSON.parse(readFileSync('public/lessons/NF_Fractions.lesson.json', 'utf8')) as Lesson

const synth = (rows: number, roles: string): Lesson => ({
  topic: 'synth',
  source: 'synth',
  items: Array.from({ length: rows }, (_, r) => r + 1).flatMap((row) =>
    [1, 2].flatMap((set) =>
      [...roles].map((role, i): LessonItem => ({
        row,
        role: role === 'm' ? 'model' : 'test',
        mode: 'typed',
        set,
        prompt: 'p',
        expected: `${row} ${set} ${i}`,
        demo: 'd',
      })),
    ),
  ),
})

const record = (row: number, over: Partial<RowRecord> = {}): RowRecord => ({
  row,
  timesServed: 1,
  firmed: true,
  firmedAt: 1000 + row,
  lastServedAt: 1000 + row,
  misses: 0,
  ...over,
})

const historyOf = (...records: RowRecord[]): RowHistory => new Map(records.map((r) => [r.row, r]))

const teachPlan = (startedAt: number, ...blocks: number[][]): SessionPlan => ({
  startedAt,
  blocks: blocks.flatMap((rows): BlockPlan[] =>
    (['instruction', 'testing'] as const).map((kind) => ({
      kind,
      rows: rows.map((row) => ({ row, set: 1 })),
      budgetMs: TEACH_BUDGET_MS,
    })),
  ),
})

type Answer = (item: LessonItem, correction: boolean) => string

function runSession(
  l: Lesson,
  plan: SessionPlan,
  opts: { answer?: Answer; gapMs?: number; visited?: string[] } = {},
): Trial[] {
  const trials: Trial[] = []
  let at = plan.startedAt
  for (let guard = 0; guard < 4000; guard++) {
    const s = replaySession(l, plan, trials)
    if (s.done) return trials
    const block = s.blocks[s.blockIndex]
    if (block.plan.kind === 'narrative') {
      trials.push({ typed: '', at: (at += opts.gapMs ?? 5000) })
      continue
    }
    const cur = block.current!
    const step = cur.state.current!
    const item = cur.lesson.items[step.item]
    opts.visited?.push(`b${s.blockIndex}r${cur.rowIndex}i${step.item}${step.correction ? 'c' : ''}`)
    at += opts.gapMs ?? 5000
    trials.push({
      typed: item.role === 'model' ? '' : (opts.answer ?? ((it: LessonItem) => it.expected))(item, step.correction),
      at,
    })
  }
  throw new Error('session did not terminate')
}

test('first session ever plans instruction/testing pairs in lesson order, set 1, with the story break at four', () => {
  const plan = planSession(lesson, new Map(), 0)
  expect(plan.blocks.map((b): [string, number | null] => [b.kind, b.rows[0]?.row ?? null])).toEqual([
    ['instruction', 1],
    ['testing', 1],
    ['instruction', 2],
    ['testing', 2],
    ['narrative', null],
    ['instruction', 3],
    ['testing', 3],
  ])
  expect(plan.blocks.flatMap((b) => b.rows).every((r) => r.set === 1)).toBe(true)
})

test('steady state plans exactly one instruction/testing pair for the next unfirm atom amid firmed review', () => {
  const history = historyOf(...[1, 2, 3, 4].map((r) => record(r)))
  const plan = planSession(lesson, history, 0)
  const taught = plan.blocks.filter((b) => b.kind === 'instruction' || b.kind === 'testing')
  const review = plan.blocks.filter((b) => b.kind === 'review')
  expect(taught.map((b) => [b.kind, ...b.rows.map((r) => r.row)])).toEqual([
    ['instruction', 5],
    ['testing', 5],
  ])
  expect(review.length).toBeGreaterThan(0)
  expect(plan.blocks[0].kind).toBe('review')
  const reviewRows = review.flatMap((b) => b.rows.map((r) => r.row))
  expect(reviewRows.length).toBeLessThanOrEqual(REVIEW_MAX)
  expect(reviewRows.every((r) => history.get(r)?.firmed)).toBe(true)
})

test('everything firmed plans review-only sessions, closed by the story break', () => {
  const rows = [...new Set(lesson.items.map((it) => it.row))]
  const plan = planSession(lesson, historyOf(...rows.map((r) => record(r))), 0)
  expect(plan.blocks.length).toBeGreaterThan(1)
  expect(plan.blocks[plan.blocks.length - 1].kind).toBe('narrative')
  expect(plan.blocks.slice(0, -1).every((b) => b.kind === 'review')).toBe(true)
})

const withNarrative = (l: Lesson): Lesson => ({ ...l, narrative: 'story.mp4' })

test('a lesson with a narrative plans it as the break closing the first four blocks', () => {
  const l = withNarrative(synth(3, 'mtt'))
  const fresh = planSession(l, new Map(), 0)
  expect(fresh.blocks[4]).toEqual({ kind: 'narrative', rows: [], budgetMs: NARRATIVE_BUDGET_MS })
  expect([...fresh.blocks.slice(0, 4), ...fresh.blocks.slice(5)]).toEqual(
    planSession(synth(3, 'mtt'), new Map(), 0).blocks,
  )
  const steady = planSession(l, historyOf(record(1)), 0)
  expect(steady.blocks.length).toBeLessThanOrEqual(5)
  expect(steady.blocks[steady.blocks.length - 1].kind).toBe('narrative')
  const reviewOnly = planSession(l, historyOf(record(1), record(2), record(3)), 0)
  expect(reviewOnly.blocks[reviewOnly.blocks.length - 1].kind).toBe('narrative')
  expect(reviewOnly.blocks.slice(0, -1).every((b) => b.kind === 'review')).toBe(true)
  expect(planSession(synth(3, 'mtt'), new Map(), 0).blocks.some((b) => b.kind === 'narrative')).toBe(false)
})

test('the default schedule emits exactly what the engine emits, with and without the story break', () => {
  const history = historyOf(...[1, 2, 3, 4].map((r) => record(r)))
  expect(planSession(lesson, history, 0, DEFAULT_SCHEDULE)).toEqual(planSession(lesson, history, 0))
  expect(planSession(synth(3, 'mtt'), historyOf(record(1)), 0, DEFAULT_SCHEDULE)).toEqual(
    planSession(synth(3, 'mtt'), historyOf(record(1)), 0),
  )
  const short = withNarrative(synth(3, 'mtt'))
  expect(planSession(short, historyOf(record(1)), 0, DEFAULT_SCHEDULE)).toEqual(
    planSession(short, historyOf(record(1)), 0),
  )
})

test('a saved schedule moves whole blocks: the teach pair stays adjacent, model before test', () => {
  const l = withNarrative(synth(3, 'mtt'))
  const plan = planSession(l, historyOf(record(1)), 0, ['teach', 'narrative', 'review-1'])
  expect(plan.blocks.map((b): [string, number | null] => [b.kind, b.rows[0]?.row ?? null])).toEqual([
    ['instruction', 2],
    ['testing', 2],
    ['narrative', null],
    ['review', 1],
  ])
})

test('unknown slot names drop and missing slots rejoin in engine order, so a stale schedule rearranges and never shrinks', () => {
  const l = withNarrative(synth(3, 'mtt'))
  const engine = planSession(l, historyOf(record(1)), 0)
  const plan = planSession(l, historyOf(record(1)), 0, ['bogus', 'narrative'])
  expect(plan.blocks.map((b) => b.kind)).toEqual(['narrative', 'review', 'instruction', 'testing'])
  expect(plan.blocks.length).toBe(engine.blocks.length)
})

test('a one-section atom: the engine splices the film after four blocks, a saved order seats it', () => {
  const base = synth(5, 'mtt')
  const l = withNarrative({ ...base, items: base.items.filter((it) => !(it.row === 5 && it.role === 'test')) })
  const history = historyOf(record(1), record(2), record(3), record(4))
  expect(planSession(l, history, 0).blocks.map((b) => b.kind)).toEqual([
    'review',
    'instruction',
    'review',
    'review',
    'narrative',
    'review',
  ])
  expect(planSession(l, history, 0, DEFAULT_SCHEDULE).blocks.map((b) => b.kind)).toEqual([
    'review',
    'instruction',
    'review',
    'narrative',
    'review',
    'review',
  ])
})

test('cold start and review-only sessions ignore the schedule: their template has no teach slot to place', () => {
  const l = withNarrative(synth(3, 'mtt'))
  const flipped = [...DEFAULT_SCHEDULE].reverse()
  expect(planSession(l, new Map(), 0, flipped)).toEqual(planSession(l, new Map(), 0))
  const done = historyOf(record(1), record(2), record(3))
  expect(planSession(l, done, 0, flipped)).toEqual(planSession(l, done, 0))
})

test('the dev jump watches past the break only when the target lies beyond it, and null targets the break itself', () => {
  const l = withNarrative(synth(3, 'mtt'))
  const { plan, trials } = jumpToRow(l, 3, 0)
  expect(plan.blocks.map((b) => b.kind)).toEqual([
    'instruction',
    'testing',
    'instruction',
    'testing',
    'narrative',
    'instruction',
    'testing',
  ])
  const s = replaySession(l, plan, trials)
  expect(s.blocks[4].done).toBe(true)
  expect(s.blockIndex).toBe(5)
  expect(plan.blocks[5].rows[0].row).toBe(3)
  const early = jumpToRow(l, 2, 0)
  const sEarly = replaySession(l, early.plan, early.trials)
  expect(sEarly.blockIndex).toBe(2)
  expect(sEarly.blocks[4].done).toBe(false)
  const top = jumpToRow(l, null, 0)
  const parked = replaySession(l, top.plan, top.trials)
  expect(parked.blockIndex).toBe(4)
  expect(parked.blocks[4]).toMatchObject({ plan: { kind: 'narrative' }, done: false, current: null })
  expect(parked.rowsFirmed).toEqual([1, 2])
  const plain = jumpToRow(synth(2, 'mtt'), null, 0)
  expect(plain.trials).toEqual([])
  expect(plain.plan.blocks[0].kind).toBe('instruction')
})

test('the dev jump can land on the checking side: the instruction block resolves on the way in', () => {
  const l = withNarrative(synth(3, 'mtt'))
  const { plan, trials } = jumpToRow(l, 3, 0, 'testing')
  const s = replaySession(l, plan, trials)
  expect(plan.blocks[s.blockIndex]).toMatchObject({ kind: 'testing', rows: [{ row: 3 }] })
  const instr = jumpToRow(l, 3, 0)
  const models = rowLesson(l, { row: 3, set: 1 }, 'instruction').items.length
  expect(trials.length).toBe(instr.trials.length + models)
  expect(jumpToRow(l, 3, 0)).toEqual(instr)
})

test('the dev jump lands on one exact question, clamped inside the target block', () => {
  const l = withNarrative(synth(3, 'mtt'))
  const { plan, trials } = jumpToRow(l, 3, 0, 'testing', 1)
  const s = replaySession(l, plan, trials)
  expect(plan.blocks[s.blockIndex]).toMatchObject({ kind: 'testing', rows: [{ row: 3 }] })
  expect(s.blocks[s.blockIndex].current?.state.current?.item).toBe(1)
  expect(trials.length).toBe(jumpToRow(l, 3, 0, 'testing').trials.length + 1)
  const far = jumpToRow(l, 3, 0, 'testing', 99)
  const sFar = replaySession(l, far.plan, far.trials)
  expect(far.plan.blocks[sFar.blockIndex]).toMatchObject({ kind: 'testing', rows: [{ row: 3 }] })
  const tests = rowLesson(l, { row: 3, set: 1 }, 'testing').items.length
  expect(sFar.blocks[sFar.blockIndex].current?.state.current?.item).toBe(tests - 1)
  expect(jumpToRow(l, 3, 0, 'testing', 0)).toEqual(jumpToRow(l, 3, 0, 'testing'))
})

test('the narrative consumes exactly one trial, holds the session open until it arrives, and banks nothing', () => {
  const l = withNarrative(synth(2, 'mtt'))
  const plan = planSession(l, new Map(), 0)
  expect(plan.blocks.map((b) => b.kind)).toEqual(['instruction', 'testing', 'instruction', 'testing', 'narrative'])
  const trials = runSession(l, plan)
  const parked = replaySession(l, plan, trials.slice(0, -1))
  expect(parked.done).toBe(false)
  expect(parked.blockIndex).toBe(4)
  expect(parked.blocks[4]).toMatchObject({ done: false, current: null, outcomes: [], cutBy: null })
  const s = replaySession(l, plan, trials)
  expect(s).toMatchObject({ done: true, graded: 4, rightFirstTry: 4, rowsFirmed: [1, 2], staleAt: null })
  expect(s.cleared).toBe(plan.blocks.length)
  expect(s.blocks[4].outcomes).toEqual([])
  const log: SessionLog = [{ kind: 'start', plan }, ...trials.map((t): SessionLog[number] => ({ kind: 'trial', ...t }))]
  const audit = replayLog(l, log)
  expect([...audit.history.keys()].sort()).toEqual([1, 2])
  expect(audit.unstamped).toBe(false)
})

test('selectReview fills the five criteria in criteria order, deduped, capped', () => {
  const history = historyOf(
    record(1, { firmedAt: 101, lastServedAt: 110 }),
    record(2, { firmedAt: 102, misses: 5, lastServedAt: 130 }),
    record(3, { firmedAt: 800, lastServedAt: 800 }),
    record(4, { firmedAt: 104, lastServedAt: 120 }),
    record(5, { firmedAt: 700, lastServedAt: 700 }),
    record(6, { firmedAt: 106, lastServedAt: 160 }),
    record(7, { firmedAt: 107, lastServedAt: 170 }),
    record(9, { firmedAt: 500, lastServedAt: 900 }),
  )
  const picks = selectReview(history, 10)
  expect(picks).toEqual([9, 3, 5, 2, 1, 4])
  expect(picks.length).toBeLessThanOrEqual(REVIEW_MAX)
})

test('the recently-firmed slots let go of a row once it has been revisited', () => {
  const revisited = historyOf(
    record(1, { firmedAt: 101, lastServedAt: 110 }),
    record(2, { firmedAt: 102, misses: 5, lastServedAt: 130 }),
    record(3, { firmedAt: 800, lastServedAt: 850 }),
    record(4, { firmedAt: 104, lastServedAt: 120 }),
    record(5, { firmedAt: 700, lastServedAt: 700 }),
  )
  expect(selectReview(revisited, null)).toEqual([5, 2, 1, 4])
  expect(selectReview(revisited, null)).not.toContain(3)
})

test('no row can camp on a review slot once every row is firm', () => {
  const l = synth(24, 'mtt')
  let at = 1000
  const log: SessionLog = []
  const served = new Map<number, number>()
  let steady = 0
  for (let s = 0; s < 30; s++) {
    const history = rowHistory(l, log)
    const all = [...new Set(l.items.map((it) => it.row))].every((r) => history.get(r)?.firmed)
    const plan = planSession(l, history, (at += 60_000))
    log.push({ kind: 'start', plan })
    if (all) steady += 1
    for (const b of plan.blocks)
      for (const r of b.rows) {
        if (all && b.kind === 'review') served.set(r.row, (served.get(r.row) ?? 0) + 1)
        for (const it of rowLesson(l, r, b.kind).items)
          log.push({ kind: 'trial', typed: it.role === 'model' ? '' : it.expected, at: (at += 4_000) })
      }
  }
  expect(steady).toBeGreaterThan(5)
  expect(Math.max(...served.values())).toBeLessThanOrEqual(steady / 2)
})

test('parallel-set parity follows timesServed', () => {
  const l = synth(3, 'mtt')
  const history = historyOf(record(1, { firmed: false, timesServed: 1 }), record(2, { firmed: false, timesServed: 2 }))
  const plan = planSession(l, history, 0)
  const rows = plan.blocks.flatMap((b) => b.rows)
  expect(rows.find((r) => r.row === 1)?.set).toBe(2)
  expect(rows.find((r) => r.row === 2)?.set).toBe(1)
  expect(rows.find((r) => r.row === 3)?.set).toBe(1)
})

test('a perfect run clears every block with exact real tallies', () => {
  const l = synth(4, 'mtt')
  const plan = teachPlan(0, [1, 2], [3, 4])
  const trials = runSession(l, plan)
  const s = replaySession(l, plan, trials)
  expect(s.done).toBe(true)
  expect(s.cleared).toBe(4)
  expect(s.blocks.every((b) => b.cutBy === null)).toBe(true)
  expect(s.graded).toBe(8)
  expect(s.rightFirstTry).toBe(8)
  expect(s.rowsFirmed).toEqual([1, 2, 3, 4])
  expect(s.activeMs).toBe(trials.length * 5000)
  expect(trials.length).toBe(4 + 8)
})

test('a slow learner is cut at a row boundary, never mid-row', () => {
  const l = synth(3, 'tt')
  const plan: SessionPlan = {
    startedAt: 0,
    blocks: [{ kind: 'review', rows: [1, 2, 3].map((row) => ({ row, set: 1 })), budgetMs: REVIEW_BUDGET_MS }],
  }
  const slow = runSession(l, plan, { gapMs: IDLE_CAP_MS })
  const s = replaySession(l, plan, slow)
  expect(s.done).toBe(true)
  expect(s.blocks[0].cutBy).toBe('budget')
  expect(s.blocks[0].outcomes.map((o) => ({ row: o.row, graded: o.graded }))).toEqual([
    { row: 1, graded: 2 },
    { row: 2, graded: 2 },
  ])
  const fast = runSession(l, plan, { gapMs: 1000 })
  expect(replaySession(l, plan, fast).blocks[0].outcomes.length).toBe(3)
})

test('an idle gap is capped so an abandoned session resumes without instant budget cuts', () => {
  expect(
    activeMs(
      [
        { typed: '', at: 1000 },
        { typed: '', at: 7_200_000 },
      ],
      0,
    ),
  ).toBe(1000 + IDLE_CAP_MS)
  const l = synth(2, 'tt')
  const plan: SessionPlan = {
    startedAt: 0,
    blocks: [{ kind: 'review', rows: [1, 2].map((row) => ({ row, set: 1 })), budgetMs: REVIEW_BUDGET_MS }],
  }
  const overnight: Trial[] = [
    { typed: '1 1 0', at: 1000 },
    { typed: '1 1 1', at: 7_200_000 },
  ]
  const s = replaySession(l, plan, overnight)
  expect(s.blocks[0].cutBy).toBe(null)
  expect(s.blocks[0].current).toEqual(expect.objectContaining({ rowIndex: 1 }))
})

test('clock skew never throws and negative gaps contribute nothing', () => {
  expect(
    activeMs(
      [
        { typed: '', at: 100 },
        { typed: '', at: 50 },
        { typed: '', at: 60 },
      ],
      0,
    ),
  ).toBe(110)
})

test('a timestamp that is not a number contributes nothing instead of poisoning the total', () => {
  expect(
    activeMs(
      [
        { typed: '', at: 1000 },
        { typed: '', at: Number.NaN },
        { typed: '', at: 3000 },
      ],
      0,
    ),
  ).toBe(1000)
  expect(activeMs([{ typed: '', at: Number.POSITIVE_INFINITY }], 0)).toBe(0)
  expect(activeMs([{ typed: '', at: 1000 }], Number.NaN)).toBe(0)
})

test('a not-firm teach row ends the block after the DI correction runs inside the row', () => {
  const l = synth(2, 'mtt')
  const plan = teachPlan(0, [1, 2])
  let missed = false
  const visited: string[] = []
  const trials = runSession(l, plan, {
    visited,
    answer: (it, correction) => {
      if (!correction && !missed && it.expected === '1 1 2') {
        missed = true
        return 'nope'
      }
      return it.expected
    },
  })
  const s = replaySession(l, plan, trials)
  expect(visited.join(' ')).toContain('b1r0i1 b1r0i1c b1r0i0c b1r0i1c')
  expect(s.done).toBe(true)
  expect(s.blocks[0].cutBy).toBe(null)
  expect(s.blocks[1].cutBy).toBe('notFirm')
  expect(s.blocks[1].outcomes).toEqual([expect.objectContaining({ row: 1, firm: false, rightFirstTry: 1, graded: 2 })])
  expect(s.rowsFirmed).toEqual([])
})

test('review rows carry tests only, and an item-0 miss retests without back-up', () => {
  const review = rowLesson(lesson, { row: 1, set: 1 }, 'review')
  expect(review.items.length).toBeGreaterThan(0)
  expect(review.items.every((it) => it.role === 'test')).toBe(true)
  expect(rowLesson(lesson, { row: 1, set: 1 }, 'instruction').items.every((it) => it.role === 'model')).toBe(true)
  expect(rowLesson(lesson, { row: 1, set: 1 }, 'instruction').items.length).toBeGreaterThan(0)

  const l = synth(1, 'tt')
  const plan: SessionPlan = {
    startedAt: 0,
    blocks: [{ kind: 'review', rows: [{ row: 1, set: 1 }], budgetMs: REVIEW_BUDGET_MS }],
  }
  let missed = false
  const visited: string[] = []
  runSession(l, plan, {
    visited,
    answer: (it, correction) => {
      if (!correction && !missed && it.expected === '1 1 0') {
        missed = true
        return 'nope'
      }
      return it.expected
    },
  })
  expect(visited.join(' ')).toBe('b0r0i0 b0r0i0c b0r0i1')
})

test('rowHistory folds sessions with sticky firm, accumulated misses, and freshest serve times', () => {
  const l = synth(3, 'mtt')
  const planA = teachPlan(0, [1, 2])
  const trialsA = runSession(l, planA, {})
  const planB: SessionPlan = {
    startedAt: 500_000,
    blocks: [
      { kind: 'review', rows: [{ row: 1, set: 1 }], budgetMs: REVIEW_BUDGET_MS },
      { kind: 'instruction', rows: [{ row: 3, set: 1 }], budgetMs: TEACH_BUDGET_MS },
      { kind: 'testing', rows: [{ row: 3, set: 1 }], budgetMs: TEACH_BUDGET_MS },
    ],
  }
  let missed = false
  const trialsB = runSession(l, planB, {
    answer: (it, correction) => {
      if (!correction && !missed && it.row === 1) {
        missed = true
        return 'nope'
      }
      return it.expected
    },
  })
  const log: SessionLog = [
    { kind: 'start', plan: planA },
    ...trialsA.map((t): SessionLog[number] => ({ kind: 'trial', ...t })),
    { kind: 'start', plan: planB },
    ...trialsB.map((t): SessionLog[number] => ({ kind: 'trial', ...t })),
  ]
  const history = rowHistory(l, log)
  expect(history.get(1)).toEqual(
    expect.objectContaining({ timesServed: 2, firmed: true, misses: 1, firmedAt: trialsA[3].at }),
  )
  expect(history.get(1)!.lastServedAt!).toBeGreaterThan(500_000)
  expect(history.get(2)).toEqual(expect.objectContaining({ timesServed: 1, firmed: true, misses: 0 }))
  expect(history.get(3)).toEqual(expect.objectContaining({ timesServed: 1, firmed: true }))
})

test('a truncated log resumes at the exact item and replays to the identical final state', () => {
  const l = synth(4, 'mtt')
  const plan = teachPlan(0, [1, 2], [3, 4])
  const trials = runSession(l, plan)
  const cutAt = 7
  const partial = replaySession(l, plan, trials.slice(0, cutAt))
  expect(partial.done).toBe(false)
  const cur = partial.blocks[partial.blockIndex].current!
  const full = replaySession(l, plan, trials)
  expect(partial.blockIndex).toBe(2)
  expect(cur.rowIndex).toBe(1)
  expect(cur.log).toEqual([])
  expect(replaySession(l, plan, [...trials.slice(0, cutAt), ...trials.slice(cutAt)])).toEqual(full)
})

test('a dev jump folds every earlier atom perfectly and lands on its instruction', () => {
  const l = synth(4, 'mtt')
  const { plan, trials } = jumpToRow(l, 3, 1000)
  expect(plan.blocks.map((b) => [b.kind, b.rows[0].row])).toEqual([
    ['instruction', 1],
    ['testing', 1],
    ['instruction', 2],
    ['testing', 2],
    ['instruction', 3],
    ['testing', 3],
    ['instruction', 4],
    ['testing', 4],
  ])
  const s = replaySession(l, plan, trials)
  expect(s.blockIndex).toBe(4)
  expect(s.blocks[4].current).toMatchObject({ rowIndex: 0, log: [] })
  expect(s.blocks.slice(0, 4).every((b) => b.done)).toBe(true)
  expect(s.rowsFirmed).toEqual([1, 2])
  expect(jumpToRow(l, 1, 0).trials).toEqual([])
})

test('a genuinely malformed plan still refuses to be replayed', () => {
  const l = synth(2, 'mtt')
  expect(() => replaySession(l, teachPlan(0, [99]), [{ typed: 'x', at: 1 }])).toThrow()
  expect(() => rowHistory(l, [{ kind: 'trial', typed: 'x', at: 1 }])).toThrow()
})

test('a stray trial after a session has already fully finished is inert, not corruption', () => {
  const l = synth(3, 'mtt')
  const plan = planSession(l, new Map(), 0)
  const trials = runSession(l, plan)
  const full = replaySession(l, plan, trials)
  expect(full).toMatchObject({ done: true, rowsFirmed: [1, 2, 3] })

  const withStray = [...trials, { typed: 'stray', at: trials[trials.length - 1].at + 1 }]
  expect(() => replaySession(l, plan, withStray)).not.toThrow()
  expect(replaySession(l, plan, withStray)).toMatchObject({ done: true, rowsFirmed: [1, 2, 3], staleAt: null })

  const log: SessionLog = [
    { kind: 'start', plan },
    ...withStray.map((t): SessionLog[number] => ({ kind: 'trial', ...t })),
  ]
  const firmed = [...rowHistory(l, log).values()].filter((r) => r.firmed).map((r) => r.row)
  expect(firmed).toEqual([1, 2, 3])
})

function stampedRun(l: Lesson, startedAt = 0): { plan: SessionPlan; log: SessionLog } {
  const plan = planSession(l, new Map(), startedAt)
  const trials = runSession(l, plan)
  return { plan, log: [{ kind: 'start', plan }, ...trials.map((t): SessionLog[number] => ({ kind: 'trial', ...t }))] }
}

const edit = (l: Lesson, f: (items: LessonItem[]) => LessonItem[]): Lesson => ({
  ...l,
  items: f(structuredClone(l.items)),
})

const at = (items: LessonItem[], row: number, role: 'model' | 'test') =>
  items.findIndex((it) => it.row === row && (it.set ?? 1) === 1 && it.role === role)

const firmedRows = (l: Lesson, log: SessionLog): number[] =>
  [...rowHistory(l, log).values()].filter((r) => r.firmed).map((r) => r.row)

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
  expect(rowFingerprint(l, { row: 1, set: 1 }, 'testing')).not.toBe(
    rowFingerprint(l, { row: 1, set: 1 }, 'instruction'),
  )
  expect(rowFingerprint(l, { row: 1, set: 1 }, 'review')).toBe(rowFingerprint(l, { row: 1, set: 1 }, 'testing'))
})

test('a fingerprint tracks what grades an answer and ignores what only presents it', () => {
  const l = synth(2, 'mtt')
  const print = (x: Lesson) => rowFingerprint(x, { row: 1, set: 1 }, 'testing')
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

test('inserting an item into a served row is caught, never silently zeroed', () => {
  const l = synth(3, 'mtt')
  const { log } = stampedRun(l)
  expect(firmedRows(l, log)).toEqual([1, 2, 3])

  const grown = edit(l, (items) => {
    const i = at(items, 1, 'test')
    items.splice(i, 0, { ...items[i] })
    return items
  })
  const audit = replayLog(grown, log)
  expect(audit.staleRows).toEqual([1])
  expect(audit.droppedRows).toEqual([1, 2, 3])
  expect(audit.lostRows).toEqual([1, 2, 3])
  expect(audit.droppedTrials).toBeGreaterThan(0)
  expect(audit.unstamped).toBe(false)
  expect(audit.unreadableSessions).toBe(0)
})

test('deleting an item from a served row is caught, never silently zeroed', () => {
  const l = synth(3, 'mtt')
  const { log } = stampedRun(l)
  const shrunk = edit(l, (items) => items.filter((_, i) => i !== at(items, 1, 'test')))
  const audit = replayLog(shrunk, log)
  expect(audit.staleRows).toEqual([1])
  expect(audit.droppedRows).toEqual([1, 2, 3])
  expect(audit.lostRows).toEqual([1, 2, 3])
  expect(audit.droppedTrials).toBeGreaterThan(0)
})

test('correcting an expected answer is caught, never used to regrade old trials', () => {
  const l = synth(3, 'mtt')
  const { log } = stampedRun(l)
  const fixed = edit(l, (items) => ((items[at(items, 1, 'test')].expected = 'corrected'), items))
  const audit = replayLog(fixed, log)
  expect(audit.staleRows).toEqual([1])
  expect(audit.history.get(1)).toBeUndefined()
  expect(audit.droppedTrials).toBeGreaterThan(0)
})

test('deleting a whole row no longer throws the entire history away', () => {
  const l = synth(3, 'mtt')
  const { log } = stampedRun(l)
  const gone = edit(l, (items) => items.filter((x) => x.row !== 1))
  expect(() => replayLog(gone, log)).not.toThrow()
  const audit = replayLog(gone, log)
  expect(audit.staleRows).toEqual([1])
  expect(audit.unreadableSessions).toBe(0)
  expect(log.filter((e) => e.kind === 'trial').length).toBeGreaterThan(0)
})

test('an edit invalidates from the row it touched onward, keeping the rows before it', () => {
  const l = synth(3, 'mtt')
  const { plan, log } = stampedRun(l)
  const trials: Trial[] = log.flatMap((e) => (e.kind === 'trial' ? [{ typed: e.typed, at: e.at }] : []))
  const late = edit(l, (items) => ((items[at(items, 3, 'test')].expected = 'corrected'), items))
  const audit = replayLog(late, log)
  expect([...audit.history.values()].filter((r) => r.firmed).map((r) => r.row)).toEqual([1, 2])
  expect(audit.staleRows).toEqual([3])
  expect(audit.lostRows).toEqual([3])

  const s = replaySession(late, plan, trials)
  expect(s.staleAt).toEqual({ block: 5, index: 0, row: 3, set: 1 })
  expect(s.blocks[5].cutBy).toBe('stale')
  expect(s.blocks[5].done).toBe(false)
  expect(s.done).toBe(false)
  expect(s.unreplayed).toBeGreaterThan(0)
  const cosmetic = edit(l, (items) => ((items[at(items, 3, 'test')].prompt = 'reworded'), items))
  expect(firmedRows(cosmetic, log)).toEqual([1, 2, 3])
  expect(replayLog(cosmetic, log).staleRows).toEqual([])
})

test('a stale row early in a stack names the later blocks it abandons', () => {
  const l = synth(24, 'mtt')
  const first = stampedRun(l, 0)
  const history = rowHistory(l, first.log)
  const firmedFirst = [...history.values()].filter((r) => r.firmed).map((r) => r.row)
  expect(firmedFirst).toEqual([1, 2, 3])

  const plan = planSession(l, history, 500_000)
  expect(plan.blocks[0].kind).toBe('review')
  expect(plan.blocks.some((b) => b.kind === 'testing')).toBe(true)
  const log: SessionLog = [
    ...first.log,
    { kind: 'start', plan },
    ...runSession(l, plan).map((t): SessionLog[number] => ({ kind: 'trial', ...t })),
  ]
  const before = [...rowHistory(l, log).values()].filter((r) => r.firmed).map((r) => r.row)
  expect(before.length).toBeGreaterThan(firmedFirst.length)

  const head = plan.blocks[0].rows[0]
  const moved = edit(l, (items) => {
    const i = items.findIndex((x) => x.row === head.row && (x.set ?? 1) === head.set && x.role === 'test')
    items[i].expected = 'corrected'
    return items
  })
  const audit = replayLog(moved, log)
  const after = [...audit.history.values()].filter((r) => r.firmed).map((r) => r.row)

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
  expect([...asBefore.history.values()].filter((r) => r.firmed).map((r) => r.row)).toEqual([1, 2, 3])
  expect(asBefore.unstamped).toBe(true)
  expect(asBefore.staleRows).toEqual([])

  const edits: Lesson[] = [
    edit(l, (items) => ((items[at(items, 1, 'test')].expected = 'corrected'), items)),
    edit(l, (items) => items.filter((_, i) => i !== at(items, 1, 'test'))),
    edit(l, (items) => items.filter((x) => x.row !== 1)),
  ]
  for (const x of edits) {
    expect(() => replayLog(x, old)).not.toThrow()
    expect(replayLog(x, old).unstamped).toBe(true)
  }
  expect(replayLog(edits[2], old).unreadableSessions).toBe(1)
  expect(replayLog(edits[2], old).staleRows).toEqual([])
  expect(replayLog(edits[2], old).droppedRows).toEqual([1, 2, 3])
})

test('one unreadable session never condemns the sessions around it', () => {
  const l = synth(6, 'mtt')
  const a = stampedRun(l, 0)
  const historyA = rowHistory(l, a.log)
  const planB = planSession(l, historyA, 500_000)
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
  expect([...audit.history.values()].filter((r) => r.firmed).map((r) => r.row)).toEqual([1, 2, 3])
})

test('a block cut at a row that missed the firm bar is not reported as cleared', () => {
  const l = synth(2, 'mtt')
  const plan = teachPlan(0, [1, 2])
  const trials = runSession(l, plan, {
    answer: (it, correction) => (correction || it.expected !== '1 1 2' ? it.expected : 'nope'),
  })
  const s = replaySession(l, plan, trials)
  expect(s.done).toBe(true)
  expect(s.blocks[1].cutBy).toBe('notFirm')
  expect(s.blocks[1].done).toBe(true)
  expect(s.rowsFirmed).toEqual([])
  expect(s.cleared).toBe(1)
})

test('a block closed by the clock still counts as cleared', () => {
  const l = synth(3, 'tt')
  const plan: SessionPlan = {
    startedAt: 0,
    blocks: [{ kind: 'review', rows: [1, 2, 3].map((row) => ({ row, set: 1 })), budgetMs: REVIEW_BUDGET_MS }],
  }
  const s = replaySession(l, plan, runSession(l, plan, { gapMs: IDLE_CAP_MS }))
  expect(s.blocks[0].cutBy).toBe('budget')
  expect(s.cleared).toBe(1)
})

test('a session can finish with nothing graded, so no first-try share exists', () => {
  const l = synth(1, 'mm')
  const plan: SessionPlan = {
    startedAt: 0,
    blocks: [{ kind: 'instruction', rows: [{ row: 1, set: 1 }], budgetMs: TEACH_BUDGET_MS }],
  }
  const s = replaySession(l, plan, runSession(l, plan))
  expect(s.done).toBe(true)
  expect(s.graded).toBe(0)
  expect(s.rightFirstTry).toBe(0)
})

test('a row with nothing a review block can serve is never planned into one', () => {
  const l = edit(synth(6, 'mtt'), (items) => items.filter((it) => !(it.row === 1 && it.role === 'test')))
  expect(rowLesson(l, { row: 1, set: 1 }, 'review').items).toEqual([])
  expect(rowLesson(l, { row: 1, set: 1 }, 'review').items).toEqual([])
  expect(rowLesson(l, { row: 1, set: 1 }, 'instruction').items.length).toBeGreaterThan(0)

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

test('replaySession is pure across the stale path too', () => {
  const l = synth(3, 'mtt')
  const { plan, log } = stampedRun(l)
  const trials = log.flatMap((e) => (e.kind === 'trial' ? [{ typed: e.typed, at: e.at }] : []))
  const moved = edit(l, (items) => ((items[at(items, 2, 'test')].expected = 'corrected'), items))
  const snapshot = JSON.stringify({ moved, plan, trials })
  const a = replaySession(moved, plan, trials)
  const b = replaySession(moved, plan, trials)
  expect(a).toEqual(b)
  expect(a.staleAt).toEqual({ block: 3, index: 0, row: 2, set: 1 })
  expect(JSON.stringify({ moved, plan, trials })).toBe(snapshot)
})

test('replaySession is pure: identical outputs, unmutated inputs', () => {
  const l = synth(2, 'mtt')
  const plan = teachPlan(0, [1, 2])
  const trials = runSession(l, plan, {
    answer: (it, correction) => (correction || it.expected !== '2 1 1' ? it.expected : 'nope'),
  })
  const snapshot = JSON.stringify({ l, plan, trials })
  const a = replaySession(l, plan, trials)
  const b = replaySession(l, plan, trials)
  expect(a).toEqual(b)
  expect(JSON.stringify({ l, plan, trials })).toBe(snapshot)
})
