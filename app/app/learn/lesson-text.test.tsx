import { fireEvent, render } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { Lesson } from '@/lib/lesson'
import { Words } from './lesson-text'
import { Host } from './teach.fixtures'

const stacks = (root: HTMLElement) => [...root.querySelectorAll('span > span > span:first-child')]

test('numeric and box fractions stack even when glued to a minus sign or an ellipsis, and everything around them survives intact', () => {
  const text = '5/8-3/8 = ▢/▢. 4/5… a/10 (5-3)/8 2 7/10-1'
  const view = render(<Words text={text} />)
  expect(view.container.textContent).toBe('58-38 = ▢▢. 45… a/10 (5-3)/8 2 710-1')
  expect(stacks(view.container).map((n) => n.textContent)).toEqual(['5', '3', '▢', '4', '7'])
})

test.each([
  [
    ['numerator', '-3'],
    ['denominator', '5'],
  ],
  [
    ['numerator', '3'],
    ['denominator', '-5'],
  ],
  [['Fraction as text', '-3/5']],
])('fraction inputs preserve and reject a negative answer: %j', (...fields) => {
  const lesson: Lesson = {
    topic: 'fraction',
    source: 'test',
    items: [
      {
        row: 1,
        role: 'test',
        mode: 'frac',
        prompt: 'Write three fifths.',
        expected: '3/5',
        demo: 'Three fifths.',
        frac: { num: null, den: null },
      },
    ],
  }
  const view = render(<Host lesson={lesson} />)
  for (const [label, value] of fields) {
    const input = view.getByLabelText(label) as HTMLInputElement
    fireEvent.change(input, { target: { value } })
    expect(input.value).toBe(value)
  }
  fireEvent.click(view.getByText('Check'))
  expect(view.getByText('not quite')).toBeTruthy()
})
