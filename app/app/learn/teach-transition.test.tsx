import { render } from '@testing-library/react'
import { act } from 'react'
import { expect, test, vi } from 'vitest'
import { check, Host, stubTransitions } from './teach.fixtures'

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
