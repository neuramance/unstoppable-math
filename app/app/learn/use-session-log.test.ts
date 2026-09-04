import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { synth } from '@/lib/session.fixtures'
import { activeId } from '@/lib/store'
import { readLog, useSessionLog } from './use-session-log'

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

test('a checked answer is durable before advancing, and a reload preserves the missed first try', () => {
  const lesson = synth(1, 't')
  const key = `um.session.${lesson.topic}:${activeId()}`
  const first = renderHook(() => useSessionLog(lesson))
  act(() => first.result.current.begin())
  act(() => {
    first.result.current.record({ typed: 'wrong' })
    first.result.current.record({ typed: 'duplicate' })
  })
  expect(first.result.current.live!.trials).toEqual([])
  expect(readLog(localStorage.getItem(key)!)!.filter((event) => event.kind === 'trial')).toEqual([
    { kind: 'trial', typed: 'wrong', at: expect.any(Number) },
  ])
  first.unmount()
  const resumed = renderHook(() => useSessionLog(lesson))
  expect(resumed.result.current.session!.blocks[0].current!.state.current).toEqual({ item: 0, correction: true })
  act(() => resumed.result.current.append({ typed: lesson.items[0].expected }))
  expect(resumed.result.current.session).toMatchObject({ done: true, rightFirstTry: 0, graded: 1, rowsFirmed: [] })
})

test('advancing after a reset cannot restore a pending answer', () => {
  const { result } = renderHook(() => useSessionLog(synth(1, 't')))
  act(() => result.current.begin())
  act(() => result.current.record({ typed: 'wrong' }))
  const advance = result.current.advance
  act(() => result.current.reset())
  act(advance)
  expect(result.current.session).toBeNull()
  expect(result.current.live).toBeNull()
})
