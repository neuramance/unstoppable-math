import * as stylex from '@stylexjs/stylex'
import type { SVGProps } from 'react'
import { t } from '@/app/tokens.stylex'
import { pickStep } from '@/lib/figures'
import type { CountKind, Figure } from '@/lib/figures'

export type FigProps = {
  fig: Figure
  counted: number
  badge?: CountKind
  shown?: number
  onPick?: (n: number) => void
  pop?: { ticks?: boolean; badges?: boolean }
}

const popKf = stylex.keyframes({
  from: { opacity: 0, transform: 'scale(0.75)' },
})

const REDUCE = '@media (prefers-reduced-motion: reduce)'

export const core = stylex.create({
  svg: {
    maxWidth: '100%',
    height: 'auto',
    display: 'block',
    outlineWidth: { default: null, ':focus-visible': '2px' },
    outlineStyle: { default: null, ':focus-visible': 'solid' },
    outlineColor: { default: null, ':focus-visible': t.accent },
    outlineOffset: { default: null, ':focus-visible': '4px' },
    borderRadius: { default: null, ':focus-visible': '4px' },
  },
  upright: {
    height: 'min(46svh, 420px)',
    width: 'auto',
  },
  cell: {
    fill: `color-mix(in srgb, ${t.accent} 16%, transparent)`,
    stroke: t.accent,
    strokeWidth: 2,
    transitionProperty: { default: 'fill, stroke', [REDUCE]: 'none' },
    transitionDuration: '0.2s',
    transitionTimingFunction: 'ease',
  },
  cellOn: {
    fill: t.accent,
    stroke: t.void,
  },
  cellPick: {
    cursor: 'pointer',
    fill: {
      default: `color-mix(in srgb, ${t.accent} 16%, transparent)`,
      ':hover': `color-mix(in srgb, ${t.accent} 38%, transparent)`,
    },
  },
  cellPickOn: {
    cursor: 'pointer',
    fill: {
      default: t.accent,
      ':hover': `color-mix(in srgb, ${t.accent} 80%, ${t.void})`,
    },
  },
  frame: {
    fill: 'none',
    stroke: t.accent,
    strokeWidth: 2.5,
    strokeLinejoin: 'round',
    pointerEvents: 'none',
  },
  ring: {
    fill: 'none',
    stroke: t.accent,
    strokeWidth: 3,
    pointerEvents: 'none',
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animationName: { default: popKf, [REDUCE]: 'none' },
    animationDuration: '0.2s',
    animationTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
    animationFillMode: 'both',
    transitionProperty: { default: 'cx, cy', [REDUCE]: 'none' },
    transitionDuration: '0.2s',
    transitionTimingFunction: 'ease',
  },
  ringDark: {
    stroke: t.void,
    opacity: 0.8,
  },
  badge: {
    fontFamily: t.sans,
    fontWeight: 700,
    fill: t.accent,
    pointerEvents: 'none',
  },
  badgeDark: {
    fill: t.void,
  },
  pop: {
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animationName: { default: popKf, [REDUCE]: 'none' },
    animationDuration: '0.2s',
    animationTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
    animationFillMode: 'both',
  },
})

export function pickable(
  label: string,
  total: number,
  counted: number,
  onPick?: (n: number) => void,
): SVGProps<SVGSVGElement> {
  if (!onPick) return { 'aria-hidden': true }
  return {
    role: 'slider',
    tabIndex: 0,
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': total,
    'aria-valuenow': counted,
    onKeyDown: (e) => {
      const to = pickStep(e.key, counted, total)
      if (to === null) return
      e.preventDefault()
      onPick(to)
    },
  }
}
