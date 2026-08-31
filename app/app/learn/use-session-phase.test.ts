import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SessionState } from '@/lib/session'
import { useSessionPhase } from './use-session-phase'

vi.mock('cuelume', () => ({ play: vi.fn() }))

const state = (blockIndex: number, done = false): SessionState =>
  ({ blockIndex, done, blocks: [] }) as unknown as SessionState

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('no session is idle and beginning one drops the stack, settling to active after the drop animation', () => {
  const { result, rerender } = renderHook(({ s }: { s: SessionState | null }) => useSessionPhase(s), {
    initialProps: { s: null as SessionState | null },
  })
  expect(result.current.phase).toBe('idle')
  expect(result.current.playing).toBe(false)

  act(() => {
    rerender({ s: state(0) })
    result.current.start()
  })
  expect(result.current.phase).toBe('dropping')
  expect(result.current.shown).toBe(0)
  expect(result.current.entrance).toBe('drop')

  act(() => vi.advanceTimersByTime(1300))
  expect(result.current.phase).toBe('active')
})

test('a block advance cracks, shatters, then settles on the next block', () => {
  const { result, rerender } = renderHook(({ s }: { s: SessionState | null }) => useSessionPhase(s), {
    initialProps: { s: state(0) },
  })
  expect(result.current.phase).toBe('active')
  expect(result.current.shown).toBe(0)

  rerender({ s: state(1) })
  expect(result.current.phase).toBe('crack')
  act(() => vi.advanceTimersByTime(160))
  expect(result.current.phase).toBe('shatter')
  act(() => vi.advanceTimersByTime(660))
  expect(result.current.phase).toBe('active')
  expect(result.current.shown).toBe(1)
  expect(result.current.entrance).toBe('step')
})

test('finishing the last block shatters into the done phase', () => {
  const { result, rerender } = renderHook(({ s }: { s: SessionState | null }) => useSessionPhase(s), {
    initialProps: { s: state(0) },
  })
  rerender({ s: state(1, true) })
  expect(result.current.phase).toBe('crack')
  act(() => vi.advanceTimersByTime(160))
  act(() => vi.advanceTimersByTime(660))
  expect(result.current.phase).toBe('done')
})

test('a vanished session clears back to idle', () => {
  const { result, rerender } = renderHook(({ s }: { s: SessionState | null }) => useSessionPhase(s), {
    initialProps: { s: state(0) as SessionState | null },
  })
  expect(result.current.phase).toBe('active')
  rerender({ s: null })
  expect(result.current.phase).toBe('idle')
  expect(result.current.playing).toBe(false)
})

test('reduced motion skips the drop and the smash choreography', () => {
  const original = window.matchMedia
  window.matchMedia = ((q: string) => ({ matches: true, media: q })) as unknown as typeof window.matchMedia
  try {
    const { result, rerender } = renderHook(({ s }: { s: SessionState | null }) => useSessionPhase(s), {
      initialProps: { s: null as SessionState | null },
    })
    act(() => {
      rerender({ s: state(0) })
      result.current.start()
    })
    expect(result.current.phase).toBe('active')

    rerender({ s: state(1) })
    expect(result.current.phase).toBe('active')
    expect(result.current.shown).toBe(1)
  } finally {
    window.matchMedia = original
  }
})
