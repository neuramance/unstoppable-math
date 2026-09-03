import { expect, test } from 'vitest'
import { readLog } from './use-session-log'

test('a stored log is read only when every event has the shape the player dereferences, so a wrong shape parks instead of crashing', () => {
  for (const text of ['not json', '{}', '[null]', '[{"kind":"trial"}]', '[{"kind":"start","plan":{"blocks":[{}]}}]'])
    expect({ text, log: readLog(text) }).toEqual({ text, log: null })
  const legacy: unknown[] = [
    { kind: 'start', plan: { startedAt: 1, blocks: [{ kind: 'instruction', rows: [{ row: 1 }], budgetMs: 1 }] } },
    { kind: 'trial', typed: '', at: 2 },
  ]
  expect(readLog(JSON.stringify(legacy))).toEqual(legacy)
  expect(readLog('[]')).toEqual([])
})
