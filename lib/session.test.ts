import { expect, test } from 'vitest'
import {
  activeMs,
  IDLE_CAP_MS,
  planSession,
  replaySession,
  REVIEW_BUDGET_MS,
  jumpToRow,
  rowHistory,
  rowLesson,
  TEACH_BUDGET_MS,
  type SessionLog,
  type SessionPlan,
  type Trial,
} from './session'
import { lesson, runSession, synth, teachPlan } from './session.fixtures'

test('a perfect run clears every block with exact real tallies', () => {
  const l = synth(4, 'mtt')
  const plan = teachPlan(0, [1, 2], [3, 4])
  const trials = runSession(l, plan)
  const s = replaySession(l, plan, trials)
  expect(s.done).toBe(true)
  expect(s.cleared).toBe(2)
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
  expect(visited.join(' ')).toContain('b0r0i2 b0r0i2c b0r0i1c b0r0i2c')
  expect(s.done).toBe(true)
  expect(s.blocks[0].cutBy).toBe('notFirm')
  expect(s.blocks[0].outcomes).toEqual([expect.objectContaining({ row: 1, firm: false, rightFirstTry: 1, graded: 2 })])
  expect(s.rowsFirmed).toEqual([])
})

test('review rows carry tests only, and an item-0 miss retests without back-up', () => {
  const review = rowLesson(lesson, { row: 1, set: 1 }, 'review')
  expect(review.items.length).toBeGreaterThan(0)
  expect(review.items.every((it) => it.role === 'test')).toBe(true)
  const atom = rowLesson(lesson, { row: 1, set: 1 }, 'atom')
  expect(atom.items.filter((it) => it.role === 'model').length).toBeGreaterThan(0)
  expect(atom.items.findIndex((it) => it.role === 'test')).toBe(atom.items.filter((it) => it.role === 'model').length)

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
      { kind: 'atom', rows: [{ row: 3, set: 1 }], budgetMs: TEACH_BUDGET_MS },
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
    expect.objectContaining({ timesServed: 2, firmed: true, misses: 1, firmedAt: trialsA[2].at }),
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
  expect(partial.blockIndex).toBe(1)
  expect(cur.rowIndex).toBe(0)
  expect(cur.log).toHaveLength(1)
  expect(replaySession(l, plan, [...trials.slice(0, cutAt), ...trials.slice(cutAt)])).toEqual(full)
})

test('a dev jump folds every earlier atom perfectly and lands on its instruction', () => {
  const l = synth(4, 'mtt')
  const { plan, trials } = jumpToRow(l, 3, 1000)
  expect(plan.blocks.map((b) => [b.kind, b.rows[0].row])).toEqual([
    ['atom', 1],
    ['atom', 2],
    ['atom', 3],
    ['atom', 4],
  ])
  const s = replaySession(l, plan, trials)
  expect(s.blockIndex).toBe(2)
  expect(s.blocks[2].current).toMatchObject({ rowIndex: 0, log: [] })
  expect(s.blocks.slice(0, 2).every((b) => b.done)).toBe(true)
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
