import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { expect, test, vi } from 'vitest'
import { LessonPlayer } from './teach'
import { ASKED, check, Host, stubTransitions } from './teach.fixtures'

test('diagram state changes inside a view transition', () => {
  const seen = stubTransitions()
  const view = render(<Host />)
  check(view)
  expect(seen.update).toBeTypeOf('function')
  expect(view.queryByText('correct')).toBeNull()
  act(() => seen.update!())
  expect(view.getByText('correct')).toBeTruthy()
})

test.each([
  ['reduced motion', true, false],
  ['autoplay', false, true],
])('%s updates without starting a view transition', (_, reduced, auto) => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduced } as MediaQueryList)
  const seen = stubTransitions()
  const view = render(<Host auto={auto} />)
  check(view)
  expect(seen.count).toBe(0)
  expect(view.getByText('correct')).toBeTruthy()
})

test('Check records once before its transition, and repeated Continue clicks only advance once', () => {
  const seen = stubTransitions()
  const onTrial = vi.fn()
  const onAdvance = vi.fn()
  const lesson = { ...ASKED, items: ASKED.items.map((item) => ({ ...item, figures: ASKED.items[0].figures })) }
  const view = render(
    <LessonPlayer lesson={lesson} log={[]} onTrial={onTrial} onAdvance={onAdvance} onMuted={() => {}} />,
  )
  check(view)
  fireEvent.click(view.getByText('Check'))
  expect(onTrial.mock.calls).toEqual([[{ typed: 'four' }]])
  expect(seen.count).toBe(1)
  act(() => seen.update!())
  fireEvent.click(view.getByText('Continue'))
  fireEvent.click(view.getByText('Continue'))
  expect(seen.count).toBe(2)
  expect(onAdvance).not.toHaveBeenCalled()
  act(() => seen.update!())
  expect(onAdvance).toHaveBeenCalledTimes(1)
  expect(onTrial).toHaveBeenCalledTimes(1)
})

test('a model records its Next click before the transition and ignores another click while moving', () => {
  const seen = stubTransitions()
  const onTrial = vi.fn()
  const onAdvance = vi.fn()
  const lesson = {
    ...ASKED,
    items: ASKED.items.map((item) => ({ ...item, role: 'model' as const, figures: ASKED.items[0].figures })),
  }
  const view = render(
    <LessonPlayer lesson={lesson} log={[]} onTrial={onTrial} onAdvance={onAdvance} onMuted={() => {}} />,
  )
  fireEvent.click(view.getByText('Next'))
  fireEvent.click(view.getByText('Next'))
  expect(onTrial.mock.calls).toEqual([[{ typed: '' }]])
  expect(onAdvance).not.toHaveBeenCalled()
  expect(seen.count).toBe(1)
  act(() => seen.update!())
  expect(onAdvance).toHaveBeenCalledTimes(1)
})
