import { expect, test } from 'vitest'
import {
  DEFAULT_SCHEDULE,
  NARRATIVE_BUDGET_MS,
  planSession,
  replayLog,
  replaySession,
  REVIEW_MAX,
  jumpToRow,
  rowHistory,
  rowLesson,
  selectReview,
  type SessionLog,
} from './session'
import { historyOf, lesson, record, runSession, synth, withNarrative } from './session.fixtures'

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
