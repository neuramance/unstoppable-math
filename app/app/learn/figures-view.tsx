import * as stylex from '@stylexjs/stylex'
import type { ReactNode, SVGProps } from 'react'
import { t } from '@/app/tokens.stylex'
import {
  BAR_ACROSS,
  FIGW,
  GRID_DOWN,
  LINE_ACROSS,
  PAD,
  R,
  UNIT_MARK_BAR,
  UNIT_MARK_BAR_HALF,
  UNIT_MARK_DROP,
  UNIT_MARK_RISE,
  badgeCount,
  badgeSize,
  barCellStart,
  barUnitStart,
  barUnitWidth,
  cellRun,
  cellStart,
  cellWidth,
  columnOffset,
  columnShare,
  figX,
  figY,
  gridColumnOf,
  gridColumns,
  gridRowOf,
  gridRows,
  longSpan,
  orientationOf,
  partOffset,
  pickStep,
  polygonRadius,
  polygonSides,
  polygonTilt,
  rectH,
  rectW,
  rectY,
  ringX,
  ringY,
  rowHeight,
  sectorAngle,
  sectorX,
  sectorY,
  spansMajorArc,
  unitMarkRoom,
  unitMarkText,
  unitWidth,
} from '@/lib/figures'
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

const styles = stylex.create({
  fig: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
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
  caption: {
    fontFamily: t.mono,
    fontSize: '12px',
    letterSpacing: '0.09em',
    color: t.mut,
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
  axis: {
    stroke: t.accent,
    strokeWidth: 3,
    strokeLinecap: 'round',
  },
  band: {
    stroke: `color-mix(in srgb, ${t.accent} 30%, transparent)`,
    strokeWidth: 12,
    transitionProperty: { default: 'x2, y2', [REDUCE]: 'none' },
    transitionDuration: '0.2s',
    transitionTimingFunction: 'ease',
  },
  tick: {
    stroke: `color-mix(in srgb, ${t.accent} 55%, transparent)`,
    strokeWidth: 2,
    strokeLinecap: 'round',
  },
  label: {
    fontFamily: t.sans,
    fontSize: '15px',
    fontWeight: 700,
    fill: t.accent,
  },
  mark: {
    fill: t.accent,
    stroke: t.void,
    strokeWidth: 2.5,
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
  pickzone: {
    fill: {
      default: 'transparent',
      ':hover': `color-mix(in srgb, ${t.accent} 22%, transparent)`,
    },
    cursor: 'pointer',
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

function pickable(
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

function wedgePath(cx: number, cy: number, r: number, sides: number, tilt: number, from: number, to: number) {
  const a0 = sectorAngle(from)
  const a1 = sectorAngle(to)
  if (sides < 3) {
    const long = spansMajorArc(from, to) ? 1 : 0
    return `M ${cx} ${cy} L ${ringX(cx, r, a0)} ${ringY(cy, r, a0)} A ${r} ${r} 0 ${long} 1 ${ringX(cx, r, a1)} ${ringY(cy, r, a1)} Z`
  }
  const angles = [a0, a1]
  for (let k = 0; k < sides; k++) {
    const corner = sectorAngle(k / sides) + tilt
    const lifted = corner + 2 * Math.PI * Math.ceil((a0 - corner) / (2 * Math.PI))
    if (lifted > a0 + 1e-9 && lifted < a1 - 1e-9) angles.push(lifted)
  }
  const pts = angles
    .sort((x, y) => x - y)
    .map((a) => {
      const reach = polygonRadius(sides, a - tilt, r)
      return `${ringX(cx, reach, a)},${ringY(cy, reach, a)}`
    })
  return `M ${cx} ${cy} L ${pts.join(' L ')} Z`
}

function BarFig({ fig, counted, badge, shown, onPick, pop }: FigProps) {
  const vert = orientationOf(fig) === 'vertical'
  const span = longSpan(vert)
  const uw = barUnitWidth(fig.units, span)
  const cw = uw / fig.parts
  const f = badgeSize(badge === 'units' ? uw : cw)
  const badges = Math.min(badgeCount(badge, fig, counted), shown ?? Infinity)
  const badgeAlong = (i: number) =>
    badge === 'units' ? barUnitStart(i, uw) + uw / 2 : barCellStart(fig, i, uw) + cellRun(fig, i, uw) / 2
  return (
    <svg
      viewBox={vert ? `0 0 ${BAR_ACROSS} ${span}` : `0 0 ${span} ${BAR_ACROSS}`}
      width={vert ? BAR_ACROSS : '100%'}
      {...stylex.props(styles.svg, vert && styles.upright)}
      {...pickable('Parts shaded', fig.units * fig.parts, counted, onPick)}
    >
      {Array.from({ length: fig.units * fig.parts }, (_, k) => {
        const along = barCellStart(fig, k, uw)
        const run = cellRun(fig, k, uw)
        return (
          <rect
            key={k}
            x={figX(along, 8, span, vert)}
            y={rectY(along, 8, run, span, vert)}
            width={rectW(run, 40, vert)}
            height={rectH(run, 40, vert)}
            {...stylex.props(
              styles.cell,
              k < counted && styles.cellOn,
              onPick && (k < counted ? styles.cellPickOn : styles.cellPick),
            )}
            onClick={onPick ? () => onPick(k + 1 === counted ? k : k + 1) : undefined}
            data-cuelume-press={onPick ? 'tick' : undefined}
          />
        )
      })}
      {Array.from({ length: fig.units }, (_, u) => {
        const along = barUnitStart(u, uw)
        return (
          <rect
            key={`f${u}`}
            x={figX(along, 8, span, vert)}
            y={rectY(along, 8, uw, span, vert)}
            width={rectW(uw, 40, vert)}
            height={rectH(uw, 40, vert)}
            {...stylex.props(styles.frame)}
          />
        )
      })}
      {Array.from({ length: badges }, (_, i) => {
        const dark = badge !== 'units' && i < counted
        return (
          <text
            key={`b${fig.parts}:${i}`}
            x={figX(badgeAlong(i), 28, span, vert)}
            y={figY(badgeAlong(i), 28, span, vert) + 0.35 * f}
            fontSize={f}
            textAnchor="middle"
            {...stylex.props(styles.badge, dark && styles.badgeDark, pop?.badges && styles.pop)}
          >
            {i + 1}
          </text>
        )
      })}
      {badges > 0 && (
        <circle
          cx={figX(badgeAlong(badges - 1), 28, span, vert)}
          cy={figY(badgeAlong(badges - 1), 28, span, vert)}
          r={f}
          {...stylex.props(styles.ring, badge !== 'units' && badges - 1 < counted && styles.ringDark)}
        />
      )}
    </svg>
  )
}

function LineFig({ fig, counted, badge, shown, onPick, pop }: FigProps) {
  const vert = orientationOf(fig) === 'vertical'
  const span = longSpan(vert)
  const total = fig.units * fig.parts
  const uw = unitWidth(fig.units, span)
  const cw = cellWidth(fig.units, fig.parts, span)
  const f = Math.min(16, badgeSize(cw))
  const badges = Math.min(badgeCount(badge, fig, counted), shown ?? Infinity)
  const badgeAlong = (i: number) => cellStart(fig, i, uw) + cellRun(fig, i, uw) / 2
  const labelDrop = vert ? 5 : 0
  const ring = badge === 'units'
  const room = unitMarkRoom(fig)
  const across = LINE_ACROSS + room + (ring ? 8 : 0)
  const axis = 34 + room
  const bleed = vert && room > 0 ? UNIT_MARK_BAR - PAD : 0
  return (
    <svg
      viewBox={vert ? `0 ${-bleed} ${across} ${span + 2 * bleed}` : `0 0 ${span} ${across}`}
      width={vert ? across : '100%'}
      {...stylex.props(styles.svg, vert && styles.upright)}
      {...pickable('Parts counted', total, counted, onPick)}
    >
      {fig.band === true && counted > 0 && (
        <line
          x1={figX(PAD, axis, span, vert)}
          y1={figY(PAD, axis, span, vert)}
          x2={figX(cellStart(fig, counted, uw), axis, span, vert)}
          y2={figY(cellStart(fig, counted, uw), axis, span, vert)}
          {...stylex.props(styles.band)}
        />
      )}
      <line
        x1={figX(PAD, axis, span, vert)}
        y1={figY(PAD, axis, span, vert)}
        x2={figX(span - PAD, axis, span, vert)}
        y2={figY(span - PAD, axis, span, vert)}
        {...stylex.props(styles.axis)}
      />
      {Array.from({ length: total + 1 }, (_, k) => {
        const unit = k % fig.parts === 0
        const a = cellStart(fig, k, uw)
        const reach = unit ? 8 : 5
        return (
          <line
            key={unit ? `u${k / fig.parts}` : `p${fig.parts}:${k}`}
            x1={figX(a, axis - reach, span, vert)}
            y1={figY(a, axis - reach, span, vert)}
            x2={figX(a, axis + reach, span, vert)}
            y2={figY(a, axis + reach, span, vert)}
            {...stylex.props(unit ? styles.axis : styles.tick, !unit && pop?.ticks && styles.pop)}
          />
        )
      })}
      {Array.from({ length: fig.units + 1 }, (_, u) => {
        const a = PAD + u * uw
        return (
          <text
            key={u}
            x={figX(a, 62 + room, span, vert)}
            y={figY(a, 62 + room, span, vert) + labelDrop}
            textAnchor="middle"
            {...stylex.props(styles.label)}
          >
            {u}
          </text>
        )
      })}
      {fig.unitMarks !== undefined &&
        Array.from({ length: fig.units + 1 }, (_, u) => {
          const a = PAD + u * uw
          const [top, bottom] = unitMarkText(fig, u).split('/') as [string, string]
          const cx = figX(a, UNIT_MARK_BAR, span, vert)
          const cy = figY(a, UNIT_MARK_BAR, span, vert)
          return (
            <g key={`m${u}`}>
              <text x={cx} y={cy - UNIT_MARK_RISE} textAnchor="middle" {...stylex.props(styles.label)}>
                {top}
              </text>
              <line
                x1={cx - UNIT_MARK_BAR_HALF}
                y1={cy}
                x2={cx + UNIT_MARK_BAR_HALF}
                y2={cy}
                {...stylex.props(styles.axis)}
              />
              <text x={cx} y={cy + UNIT_MARK_DROP} textAnchor="middle" {...stylex.props(styles.label)}>
                {bottom}
              </text>
            </g>
          )
        })}
      {counted > 0 && (
        <circle
          cx={figX(cellStart(fig, counted, uw), axis, span, vert)}
          cy={figY(cellStart(fig, counted, uw), axis, span, vert)}
          r={6}
          {...stylex.props(styles.mark)}
        />
      )}
      {!ring &&
        Array.from({ length: badges }, (_, i) => (
          <text
            key={`b${fig.parts}:${i}`}
            x={figX(badgeAlong(i), 20 + room, span, vert)}
            y={figY(badgeAlong(i), 20 + room, span, vert)}
            fontSize={f}
            textAnchor="middle"
            {...stylex.props(styles.badge, pop?.badges && styles.pop)}
          >
            {i + 1}
          </text>
        ))}
      {badges > 0 &&
        (ring ? (
          <circle
            cx={figX(PAD + badges * uw, 62 + room, span, vert)}
            cy={figY(PAD + badges * uw, 62 + room, span, vert) + labelDrop - 5}
            r={10}
            {...stylex.props(styles.ring)}
          />
        ) : (
          <circle
            cx={figX(badgeAlong(badges - 1), 20 + room, span, vert)}
            cy={figY(badgeAlong(badges - 1), 20 + room, span, vert) - 0.3 * f}
            r={0.8 * f}
            {...stylex.props(styles.ring)}
          />
        ))}
      {onPick &&
        Array.from({ length: total }, (_, k) => (
          <circle
            key={k}
            cx={figX(cellStart(fig, k + 1, uw), axis, span, vert)}
            cy={figY(cellStart(fig, k + 1, uw), axis, span, vert)}
            r={Math.min(cellRun(fig, k, uw) / 2, 14)}
            {...stylex.props(styles.pickzone)}
            onClick={() => onPick(k + 1 === counted ? 0 : k + 1)}
            data-cuelume-press="tick"
          />
        ))}
    </svg>
  )
}

function GridFig({ fig, counted, badge, shown, onPick, pop }: FigProps) {
  const columns = gridColumns(fig)
  const rows = gridRows(fig.parts, columns)
  const across = FIGW - 2 * PAD
  const down = rowHeight(rows)
  const xOf = (column: number) => PAD + columnOffset(fig, column, columns) * across
  const wOf = (column: number) => columnShare(fig, column, columns) * across
  const yOf = (row: number) => PAD + row * down
  const f = badgeSize(Math.min(wOf(0), down))
  const badges = Math.min(badgeCount(badge, fig, counted), shown ?? Infinity)
  const badgeSpot = (i: number): [number, number] => {
    if (badge === 'units') return [PAD + across / 2, PAD + (GRID_DOWN - 2 * PAD) / 2]
    const column = gridColumnOf(i, rows)
    return [xOf(column) + wOf(column) / 2, yOf(gridRowOf(i, rows)) + down / 2]
  }
  return (
    <svg
      viewBox={`0 0 ${FIGW} ${GRID_DOWN}`}
      width="100%"
      {...stylex.props(styles.svg)}
      {...pickable('Parts shaded', fig.units * fig.parts, counted, onPick)}
    >
      {Array.from({ length: fig.parts }, (_, k) => {
        const column = gridColumnOf(k, rows)
        return (
          <rect
            key={k}
            x={xOf(column)}
            y={yOf(gridRowOf(k, rows))}
            width={wOf(column)}
            height={down}
            {...stylex.props(
              styles.cell,
              k < counted && styles.cellOn,
              onPick && (k < counted ? styles.cellPickOn : styles.cellPick),
            )}
            onClick={onPick ? () => onPick(k + 1 === counted ? k : k + 1) : undefined}
            data-cuelume-press={onPick ? 'tick' : undefined}
          />
        )
      })}
      <rect x={PAD} y={PAD} width={across} height={GRID_DOWN - 2 * PAD} {...stylex.props(styles.frame)} />
      {Array.from({ length: badges }, (_, i) => {
        const [bx, by] = badgeSpot(i)
        const dark = badge !== 'units' && i < counted
        return (
          <text
            key={`b${fig.parts}:${i}`}
            x={bx}
            y={by + 0.35 * f}
            fontSize={f}
            textAnchor="middle"
            {...stylex.props(styles.badge, dark && styles.badgeDark, pop?.badges && styles.pop)}
          >
            {i + 1}
          </text>
        )
      })}
      {badges > 0 && (
        <circle
          cx={badgeSpot(badges - 1)[0]}
          cy={badgeSpot(badges - 1)[1]}
          r={f}
          {...stylex.props(styles.ring, badge !== 'units' && badges - 1 < counted && styles.ringDark)}
        />
      )}
    </svg>
  )
}

export type RoundLayout = 'grid' | 'grouped'

export function RoundFig({
  fig,
  counted,
  badge,
  shown,
  pop,
  radius = R,
  layout = 'grid',
}: FigProps & { radius?: number; layout?: RoundLayout }) {
  const r = radius
  const sides = polygonSides(fig.kind, fig.parts)
  const tilt = polygonTilt(fig.kind)
  const step = 2 * r + 16
  const grouped = layout === 'grouped' && fig.units >= 2 && fig.units <= 4
  const posOf = (u: number): [number, number] => {
    if (!grouped) return [u % 3, Math.floor(u / 3)]
    if (fig.units === 2) return [0, u]
    if (fig.units === 3) return u === 0 ? [0.5, 0] : [u - 1, 1]
    return [u % 2, Math.floor(u / 2)]
  }
  const cols = grouped ? (fig.units === 2 ? 1 : 2) : Math.min(fig.units, 3)
  const rowsOf = grouped ? 2 : Math.ceil(fig.units / 3)
  const w = cols * step + 8
  const h = (rowsOf - 1) * step + 2 * r + 12
  const cxOf = (u: number) => 4 + posOf(u)[0] * step + step / 2
  const cyOf = (u: number) => r + 6 + posOf(u)[1] * step
  const f = badgeSize(badge === 'units' ? r : (2 * Math.PI * 0.62 * r) / fig.parts)
  const centroid = (u: number, s: number) => {
    const a = sectorAngle((partOffset(fig, s) + partOffset(fig, s + 1)) / 2)
    const reach = 0.62 * polygonRadius(sides, a - tilt, r)
    return { x: ringX(cxOf(u), reach, a), y: ringY(cyOf(u), reach, a) + 0.35 * f }
  }
  const badges = Math.min(badgeCount(badge, fig, counted), shown ?? Infinity)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} aria-hidden="true" {...stylex.props(styles.svg)}>
      {Array.from({ length: fig.units }, (_, u) => {
        const cx = cxOf(u)
        const cy = cyOf(u)
        const ngon = (n: number) =>
          Array.from({ length: n }, (_, i) => `${sectorX(cx, i, n, r, tilt)},${sectorY(cy, i, n, r, tilt)}`).join(' ')
        if (fig.parts === 1) {
          if (sides < 3) return <circle key={u} cx={cx} cy={cy} r={r} {...stylex.props(styles.cell)} />
          return <polygon key={u} points={ngon(sides)} {...stylex.props(styles.cell)} />
        }
        return (
          <g key={u}>
            {Array.from({ length: fig.parts }, (_, s) => (
              <path
                key={s}
                d={wedgePath(cx, cy, r, sides, tilt, partOffset(fig, s), partOffset(fig, s + 1))}
                {...stylex.props(styles.cell, u * fig.parts + s < counted && styles.cellOn)}
              />
            ))}
            {sides < 3 ? (
              <circle cx={cx} cy={cy} r={r} {...stylex.props(styles.frame)} />
            ) : (
              <polygon points={ngon(sides)} {...stylex.props(styles.frame)} />
            )}
          </g>
        )
      })}
      {badge === 'units' &&
        Array.from({ length: badges }, (_, u) => (
          <text
            key={`b${fig.parts}:${u}`}
            x={cxOf(u)}
            y={cyOf(u) + 0.35 * f}
            fontSize={f}
            textAnchor="middle"
            {...stylex.props(styles.badge, pop?.badges && styles.pop)}
          >
            {u + 1}
          </text>
        ))}
      {badge === 'units' && badges > 0 && (
        <circle cx={cxOf(badges - 1)} cy={cyOf(badges - 1)} r={f} {...stylex.props(styles.ring)} />
      )}
      {badge !== 'units' &&
        Array.from({ length: badges }, (_, i) => {
          const p = centroid(Math.floor(i / fig.parts), i % fig.parts)
          const dark = badge === 'counted' || i < counted
          return (
            <text
              key={`b${fig.parts}:${i}`}
              x={p.x}
              y={p.y}
              fontSize={f}
              textAnchor="middle"
              {...stylex.props(styles.badge, dark && styles.badgeDark, pop?.badges && styles.pop)}
            >
              {i + 1}
            </text>
          )
        })}
      {badge !== 'units' &&
        badges > 0 &&
        (() => {
          const p = centroid(Math.floor((badges - 1) / fig.parts), (badges - 1) % fig.parts)
          const dark = badge === 'counted' || badges - 1 < counted
          return (
            <circle cx={p.x} cy={p.y - 0.35 * f} r={0.9 * f} {...stylex.props(styles.ring, dark && styles.ringDark)} />
          )
        })()}
    </svg>
  )
}

export function FigureView({ fig, counted, badge, shown, onPick, pop, label }: FigProps & { label?: ReactNode }) {
  const svg =
    fig.kind === 'bar' ? (
      <BarFig fig={fig} counted={counted} badge={badge} shown={shown} onPick={onPick} pop={pop} />
    ) : fig.kind === 'number-line' ? (
      <LineFig fig={fig} counted={counted} badge={badge} shown={shown} onPick={onPick} pop={pop} />
    ) : fig.kind === 'grid' ? (
      <GridFig fig={fig} counted={counted} badge={badge} shown={shown} onPick={onPick} pop={pop} />
    ) : (
      <RoundFig fig={fig} counted={counted} badge={badge} shown={shown} pop={pop} />
    )
  return (
    <div {...stylex.props(styles.fig)}>
      {label && <span {...stylex.props(styles.caption)}>{label}</span>}
      {svg}
    </div>
  )
}
