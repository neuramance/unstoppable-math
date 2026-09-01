import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { afterAll, expect, test } from 'vitest'
import type { Lesson } from '@/lib/lesson'
import { LessonPlayer } from './teach'

const lesson: Lesson = {
  topic: 'test',
  source: 'test',
  items: [
    {
      row: 1,
      role: 'test',
      mode: 'typed',
      prompt: 'How many parts?',
      expected: '2',
      demo: 'Two parts.',
      figures: [{ kind: 'bar', units: 1, parts: 2 }],
    },
  ],
}

const originalMatchMedia = window.matchMedia
const originalStartViewTransition = document.startViewTransition
const player = (auto = false) => (
  <LessonPlayer lesson={lesson} log={[]} onTrial={() => {}} auto={auto} onMuted={() => {}} />
)

function reducedMotion(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

afterAll(() => {
  window.matchMedia = originalMatchMedia
  document.startViewTransition = originalStartViewTransition
})

test('diagram state changes inside a view transition', () => {
  reducedMotion(false)
  let update: ViewTransitionUpdateCallback | undefined
  document.startViewTransition = ((callback) => {
    if (typeof callback !== 'function') throw new TypeError('expected a transition callback')
    update = callback
    return {} as ViewTransition
  }) as typeof document.startViewTransition

  const view = render(player())
  fireEvent.change(view.getByLabelText('Your answer'), { target: { value: '2' } })
  fireEvent.click(view.getByText('Check'))

  expect(update).toBeDefined()
  expect(view.queryByText('correct')).toBeNull()
  act(() => {
    update!()
  })
  expect(view.getByText('correct')).toBeTruthy()
  view.unmount()
})

test('reduced motion updates without starting a view transition', () => {
  reducedMotion(true)
  let transitions = 0
  document.startViewTransition = (() => {
    transitions += 1
    return {} as ViewTransition
  }) as typeof document.startViewTransition

  const view = render(player())
  fireEvent.change(view.getByLabelText('Your answer'), { target: { value: '2' } })
  fireEvent.click(view.getByText('Check'))

  expect(transitions).toBe(0)
  expect(view.getByText('correct')).toBeTruthy()
  view.unmount()
})

test('autoplay updates without starting a view transition', () => {
  reducedMotion(false)
  let transitions = 0
  document.startViewTransition = (() => {
    transitions += 1
    return {} as ViewTransition
  }) as typeof document.startViewTransition

  const view = render(player(true))
  fireEvent.change(view.getByLabelText('Your answer'), { target: { value: '2' } })
  fireEvent.click(view.getByText('Check'))

  expect(transitions).toBe(0)
  expect(view.getByText('correct')).toBeTruthy()
  view.unmount()
})
