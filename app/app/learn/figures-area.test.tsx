import { fireEvent, render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FIGURE_KINDS, type FigureKind } from '@/lib/figures'
import { FigureView } from './figures-view'

test.each(FIGURE_KINDS)('%s supports keyboard shading and a click on its last part', (kind) => {
  const onPick = vi.fn()
  const units = kind === 'grid' ? 1 : 2
  const view = render(<FigureView fig={{ kind, units, parts: 4 }} counted={0} onPick={onPick} />)
  fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowRight' })
  expect(onPick).toHaveBeenLastCalledWith(1)
  const cells = view.container.querySelectorAll('[data-cuelume-press="tick"]')
  expect(cells).toHaveLength(units * 4)
  fireEvent.click(cells[cells.length - 1])
  expect(onPick).toHaveBeenLastCalledWith(units * 4)
})

const area = (path: Element) => {
  const numbers = path
    .getAttribute('d')!
    .match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)!
    .map(Number)
  const points = Array.from({ length: numbers.length / 2 }, (_, i) => [numbers[i * 2], numbers[i * 2 + 1]])
  return (
    Math.abs(
      points.reduce((sum, [x, y], i) => {
        const next = points[(i + 1) % points.length]
        return sum + x * next[1] - y * next[0]
      }, 0),
    ) / 2
  )
}

test.each<FigureKind>(['triangle', 'square', 'pentagon', 'hexagon', 'polygon'])(
  '%s has equal-area parts at every supported partition count',
  (kind) => {
    const view = render(null)
    for (let parts = 2; parts <= 20; parts++) {
      view.rerender(<FigureView fig={{ kind, units: 1, parts }} counted={0} />)
      const areas = [...view.container.querySelectorAll('path')].map(area)
      expect(areas).toHaveLength(parts)
      for (const value of areas) expect(value).toBeCloseTo(areas[0], 7)
    }
  },
)

test('explicitly unequal polygon parts keep their unequal areas', () => {
  const view = render(<FigureView fig={{ kind: 'square', units: 1, parts: 2, bounds: [0.2] }} counted={0} />)
  const areas = [...view.container.querySelectorAll('path')].map(area)
  expect(areas[1] / areas[0]).toBeCloseTo(4, 8)
})

test.each<FigureKind>(['circle', 'square'])('%s with one part per unit still shades whole units', (kind) => {
  const onPick = vi.fn()
  const view = render(<FigureView fig={{ kind, units: 2, parts: 1 }} counted={1} onPick={onPick} />)
  const cells = view.container.querySelectorAll('[data-cuelume-press="tick"]')
  expect(cells).toHaveLength(2)
  expect(view.getByRole('slider').getAttribute('aria-valuenow')).toBe('1')
  fireEvent.click(cells[0])
  expect(onPick).toHaveBeenLastCalledWith(0)
  fireEvent.click(cells[1])
  expect(onPick).toHaveBeenCalledWith(2)
})
