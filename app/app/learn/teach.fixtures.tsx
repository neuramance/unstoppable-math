import { fireEvent, render } from '@testing-library/react'
import { act, useRef, useState } from 'react'
import { beforeEach } from 'vitest'
import type { Lesson, TrialEntry } from '@/lib/lesson'
import { LessonPlayer } from './teach'

export class FakeAudio {
  static instances: FakeAudio[] = []
  static verdict: 'resolve' | 'reject' = 'resolve'
  static plays: string[] = []
  src = ''
  muted = false
  paused = true
  duration = 0.001
  onended: (() => void) | null = null
  constructor() {
    FakeAudio.instances.push(this)
  }
  play(): Promise<void> {
    FakeAudio.plays.push(this.src)
    if (FakeAudio.verdict === 'reject') return Promise.reject(new Error('blocked'))
    this.paused = false
    return Promise.resolve()
  }
  pause(): void {
    this.paused = true
  }
}

globalThis.Audio = FakeAudio as unknown as typeof Audio

beforeEach(() => {
  FakeAudio.instances = []
  FakeAudio.plays = []
  FakeAudio.verdict = 'resolve'
})

export const flush = () => act(async () => {})

export const line = (parts: number) => ({ kind: 'number-line' as const, units: 3, parts })

export const ASKED = {
  topic: 'asked',
  source: 'asked',
  items: [
    {
      row: 1,
      role: 'test',
      mode: 'typed',
      prompt: 'How many parts?',
      expected: 'four',
      demo: '*Four* parts.',
      figures: [line(4)],
    },
    { row: 1, role: 'test', mode: 'typed', prompt: 'And now?', expected: 'seven', demo: 'Seven.', figures: [line(7)] },
  ],
} satisfies Lesson

export function Host({
  lesson = ASKED,
  auto = false,
  muted = false,
}: {
  lesson?: Lesson
  auto?: boolean
  muted?: boolean
}) {
  const [log, setLog] = useState<TrialEntry[]>([])
  const saved = useRef(log)
  return (
    <LessonPlayer
      lesson={lesson}
      log={log}
      onTrial={(e) => {
        saved.current = [...saved.current, e]
      }}
      onAdvance={() => setLog(saved.current)}
      auto={auto}
      muted={muted}
      onMuted={() => {}}
    />
  )
}

export function stubTransitions() {
  const seen = { count: 0, update: null as null | (() => void), finished: Promise.resolve() }
  document.startViewTransition = ((cb: () => void) => {
    seen.count += 1
    seen.update = cb
    return { finished: seen.finished } as ViewTransition
  }) as typeof document.startViewTransition
  return seen
}

export function check(view: ReturnType<typeof render>, value = 'four') {
  fireEvent.change(view.getByLabelText('Your answer'), { target: { value } })
  fireEvent.click(view.getByText('Check'))
}
