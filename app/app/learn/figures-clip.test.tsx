import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { CountKind, Figure } from '@/lib/figures'
import { lesson } from '@/lib/session.fixtures'
import { FigureView } from './figures-view'

const STROKE_ROOM = 2
const SHOWN = [undefined, 1, 2, 3, 4, 5, 6, 8, 10, 12, 20]

const combos = new Map<string, { fig: Figure; badge: CountKind | undefined }>()
for (const item of lesson.items)
  for (const fig of item.figures ?? []) combos.set(JSON.stringify([fig, item.count]), { fig, badge: item.count })

const num = (el: Element, name: string) => Number(el.getAttribute(name))

function extentOf(el: Element): [number, number, number, number] | null {
  if (el.tagName === 'circle') {
    const [cx, cy, r] = [num(el, 'cx'), num(el, 'cy'), num(el, 'r')]
    return Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r) ? [cx - r, cy - r, cx + r, cy + r] : null
  }
  const [x1, y1, x2, y2] = [num(el, 'x1'), num(el, 'y1'), num(el, 'x2'), num(el, 'y2')]
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]
}

function overflowsIn(svg: SVGSVGElement, label: string): string[] {
  const box = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number)
  if (box.length !== 4) return []
  const [vx, vy, vw, vh] = box
  return Array.from(svg.querySelectorAll('circle, line')).flatMap((el) => {
    const extent = extentOf(el)
    if (extent === null) return []
    const [x0, y0, x1, y1] = extent
    const over = [
      x0 - STROKE_ROOM < vx ? 'left' : '',
      x1 + STROKE_ROOM > vx + vw ? 'right' : '',
      y0 - STROKE_ROOM < vy ? 'top' : '',
      y1 + STROKE_ROOM > vy + vh ? 'bottom' : '',
    ].filter(Boolean)
    return over.length === 0 ? [] : [`${label} ${el.tagName} r=${el.getAttribute('r') ?? '-'} off ${over.join('+')}`]
  })
}

test('every figure keeps its strokes inside the viewBox, so nothing is clipped at the edges', () => {
  const clipped = new Set<string>()
  const view = render(null)
  for (const { fig, badge } of combos.values()) {
    const label = `${fig.kind} u=${fig.units} p=${fig.parts} ${fig.orientation ?? 'horizontal'} badge=${badge}`
    for (const shown of badge === undefined ? [undefined] : SHOWN) {
      view.rerender(<FigureView fig={fig} counted={fig.counted ?? 0} badge={badge} shown={shown} />)
      for (const svg of view.container.querySelectorAll<SVGSVGElement>('svg'))
        for (const hit of overflowsIn(svg, label)) clipped.add(hit)
    }
  }
  expect(combos.size).toBeGreaterThan(200)
  expect([...clipped]).toEqual([])
})
