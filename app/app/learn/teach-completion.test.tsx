import { fireEvent, render, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { lesson } from '@/lib/session.fixtures'
import { gradeItem } from '@/lib/lesson'
import { Host } from './teach.fixtures'
import { FractionNumberLine } from './fraction-number-line'

const lineItems = lesson.items.filter((item) => item.mode === 'line-fractions')
const sums = lesson.items.filter((item) => item.mode === 'decompose')

test.each(lineItems)('fraction labels $row $expected are editable at their number-line positions', (item) => {
  const view = render(<Host lesson={{ ...lesson, items: [item] }} muted />)
  const check = view.getByRole('button', { name: /Check/ })
  const expected = item.expected.split(' ')
  for (const [unit, value] of expected.entries()) {
    expect(check.hasAttribute('disabled')).toBe(true)
    const group = view.getByRole('group', { name: `At ${unit}` })
    fireEvent.change(within(group).getByRole('textbox'), { target: { value } })
  }
  fireEvent.click(check)
  expect(view.getByText('correct', { exact: true })).toBeTruthy()
})

test('a wrong label fails the whole number line and is cleared for the retry', () => {
  const item = lineItems[0]
  const view = render(<Host lesson={{ ...lesson, items: [item] }} muted />)
  for (const field of view.getAllByRole('textbox')) fireEvent.change(field, { target: { value: '99' } })
  fireEvent.click(view.getByRole('button', { name: /Check/ }))
  expect(view.getByText('not quite')).toBeTruthy()
  fireEvent.click(view.getByRole('button', { name: /Continue/ }))
  expect(view.getAllByRole('textbox').every((field) => (field as HTMLInputElement).value === '')).toBe(true)
})

test.each(sums)('$expr accepts independently constructed sums in any order', (item) => {
  const view = render(<Host lesson={{ ...lesson, items: [item] }} muted />)
  const fields = view.getAllByRole('textbox')
  const alternative = item.expected
    .split(';')
    .reverse()
    .flatMap((sum) => sum.split(' ').reverse())
  expect(fields).toHaveLength(alternative.length)
  for (const [i, value] of alternative.entries()) {
    expect(view.getByRole('button', { name: /Check/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(fields[i], { target: { value } })
  }
  fireEvent.click(view.getByRole('button', { name: /Check/ }))
  expect(view.getByText('correct', { exact: true })).toBeTruthy()
  expect(fields.map((field) => (field as HTMLInputElement).value)).toEqual(alternative)
})

test('decomposition rejects repeated, swapped, incomplete, nonpositive, and incorrect sums', () => {
  const item = sums[0]
  for (const answer of ['1 3;1 3', '1 3;3 1', '1 3', '0 4;2 2', '-1 5;2 2', '1.5 2.5;2 2', '1 2;2 2', 'a b;2 2'])
    expect(gradeItem(item, answer), answer).toBe(false)
})

test('reason choices reject a misconception and require a fresh choice after correction', () => {
  const item = lesson.items.find((i) => i.mode === 'choice')!
  if (item.mode !== 'choice') throw new Error('missing choice fixture')
  const view = render(<Host lesson={{ ...lesson, items: [item] }} muted />)
  const wrong = item.choices.find((choice) => choice !== item.expected)!
  fireEvent.click(view.getByRole('radio', { name: wrong }))
  fireEvent.click(view.getByRole('button', { name: /Check/ }))
  expect(view.getByText('not quite')).toBeTruthy()
  fireEvent.click(view.getByRole('button', { name: /Continue/ }))
  expect(view.getByRole('button', { name: /Check/ }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(view.getByRole('radio', { name: item.expected }))
  fireEvent.click(view.getByRole('button', { name: /Check/ }))
  expect(view.getByText('correct', { exact: true })).toBeTruthy()
})

test('equivalent fractions share one plotted position and unequal fractions have distinct positions', () => {
  const view = render(<FractionNumberLine fractions={['6/4', '9/6', '5/2', '1/4']} />)
  const points = view.container.querySelectorAll('circle')
  expect(points[0].getAttribute('cx')).toBe(points[1].getAttribute('cx'))
  expect(points[0].getAttribute('cx')).not.toBe(points[2].getAttribute('cx'))
  expect(parseFloat(points[3].getAttribute('cx')!)).toBeCloseTo(6.3, 12)
  expect(view.getByRole('img').getAttribute('aria-label')).toContain('zero to ten')
})

test('nearby fraction locations can be enlarged without changing their values', () => {
  const view = render(<FractionNumberLine fractions={['4/10', '9/20']} />)
  const separation = () => {
    const points = view.container.querySelectorAll('circle')
    return parseFloat(points[1].getAttribute('cx')!) - parseFloat(points[0].getAttribute('cx')!)
  }
  const initial = separation()
  fireEvent.click(view.getByRole('button', { name: 'Zoom in on the fractions' }))
  expect(separation()).toBeCloseTo(initial * 10)
  expect(view.getByRole('img').getAttribute('aria-label')).toContain('zero to 1')
  fireEvent.click(view.getByRole('button', { name: 'Show 0 to 10' }))
  expect(separation()).toBeCloseTo(initial)
})
