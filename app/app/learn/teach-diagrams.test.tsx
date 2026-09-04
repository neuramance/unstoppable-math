import { fireEvent, render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { gradeItem } from '@/lib/lesson'
import { lesson } from '@/lib/session.fixtures'
import { Host } from './teach.fixtures'
import { FigureView } from './figures-view'

const questions = lesson.items.filter((item) => item.mode === 'construct' || item.mode === 'shade-fraction')

test.each(questions)('$mode task $expected requires every part of the response before passing', (item) => {
  const view = render(<Host lesson={{ ...lesson, items: [item] }} muted />)
  const check = view.getByRole('button', { name: /Check/ })
  expect(check.hasAttribute('disabled')).toBe(true)
  const sliders = view.getAllByRole('slider')
  if (item.mode === 'construct') {
    for (const [i, figure] of item.figures.entries()) {
      fireEvent.change(view.getByLabelText(`Equal parts in diagram ${i + 1}`), {
        target: { value: figure.parts },
      })
      for (let n = 0; n < figure.counted; n++) fireEvent.keyDown(sliders[i], { key: 'ArrowRight' })
    }
    expect(check.hasAttribute('disabled')).toBe(true)
    fireEvent.click(view.getByLabelText(item.expected.endsWith('yes') ? 'Yes' : 'No'))
  } else {
    for (let n = 0; n < item.figures[0].counted; n++) fireEvent.keyDown(sliders[0], { key: 'ArrowRight' })
    expect(check.hasAttribute('disabled')).toBe(true)
    fireEvent.change(view.getByLabelText('numerator'), { target: { value: String(item.figures[0].counted) } })
  }
  fireEvent.click(check)
  expect(view.getByText('correct', { exact: true })).toBeTruthy()
})

test('equivalence alone cannot pass when a diagram is wrong, and correction starts with empty diagrams', () => {
  const item = questions.find((q) => q.mode === 'construct')!
  const view = render(<Host lesson={{ ...lesson, items: [item] }} muted />)
  fireEvent.click(view.getByLabelText('Yes'))
  fireEvent.click(view.getByRole('button', { name: /Check/ }))
  expect(view.getByText('not quite')).toBeTruthy()
  fireEvent.click(view.getByRole('button', { name: /Continue/ }))
  for (const slider of view.getAllByRole('slider')) expect(slider.getAttribute('aria-valuenow')).toBe('0')
  expect(view.getByRole('button', { name: /Check/ }).hasAttribute('disabled')).toBe(true)
})

test('a fraction answer cannot pass without the correct shading', () => {
  const item = questions.find((q) => q.mode === 'shade-fraction')!
  const view = render(<Host lesson={{ ...lesson, items: [item] }} muted />)
  fireEvent.change(view.getByLabelText('numerator'), { target: { value: '9' } })
  fireEvent.click(view.getByRole('button', { name: /Check/ }))
  expect(view.getByText('not quite')).toBeTruthy()
  expect(gradeItem(item, '9 8')).toBe(false)
  expect(gradeItem(item, '8 9')).toBe(false)
})

test('row-based grid shading fills complete rows', () => {
  const fig = { kind: 'grid' as const, units: 1, parts: 18, columns: 6, orientation: 'horizontal' as const }
  const view = render(<FigureView fig={fig} counted={6} onPick={() => {}} />)
  const cells = Array.from(view.container.querySelectorAll('rect')).slice(0, 18)
  expect(new Set(cells.slice(0, 6).map((cell) => cell.getAttribute('y'))).size).toBe(1)
  expect(cells[6].getAttribute('y')).not.toBe(cells[0].getAttribute('y'))
})

test('construction answer keys agree with the supplied fraction diagrams', () => {
  for (const item of questions) {
    if (item.mode !== 'construct') continue
    const [a, b] = item.figures
    const verdict = a.counted * b.parts === b.counted * a.parts ? 'yes' : 'no'
    expect(item.expected).toBe(`${a.parts} ${a.counted} ${b.parts} ${b.counted} ${verdict}`)
    expect(gradeItem(item, item.expected.replace(/yes|no$/, verdict === 'yes' ? 'no' : 'yes'))).toBe(false)
  }
})
