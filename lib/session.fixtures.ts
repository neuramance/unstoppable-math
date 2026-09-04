import { readFileSync } from 'node:fs'
import type { Lesson, LessonItem } from './lesson'
import { replaySession, TEACH_BUDGET_MS } from './session'
import type { BlockPlan, RowHistory, RowRecord, SessionPlan, Trial } from './session'

export const lesson = JSON.parse(readFileSync('public/lessons/NF_Fractions.lesson.json', 'utf8')) as Lesson

export const synth = (rows: number, roles: string): Lesson => ({
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

export const record = (row: number, over: Partial<RowRecord> = {}): RowRecord => ({
  row,
  timesServed: 1,
  firmed: true,
  firmedAt: 1000 + row,
  lastServedAt: 1000 + row,
  misses: 0,
  ...over,
})

export const historyOf = (...records: RowRecord[]): RowHistory => new Map(records.map((r) => [r.row, r]))

export const teachPlan = (startedAt: number, ...blocks: number[][]): SessionPlan => ({
  startedAt,
  blocks: blocks.map((rows): BlockPlan => ({
    kind: 'atom',
    rows: rows.map((row) => ({ row, set: 1 })),
    budgetMs: TEACH_BUDGET_MS,
  })),
})

export const item = (mode: 'typed' | 'frac' | 'shade', expected: string, accept?: string[]): LessonItem => ({
  row: 1,
  role: 'test',
  mode,
  prompt: 'p',
  expected,
  demo: '*d*',
  ...(accept === undefined ? {} : { accept }),
})

export function runSession(
  l: Lesson,
  plan: SessionPlan,
  opts: { answer?: (item: LessonItem, correction: boolean) => string; gapMs?: number; visited?: string[] } = {},
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
export const withNarrative = (l: Lesson): Lesson => ({ ...l, narrative: 'story.mp4' })
