import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { t } from '@/app/tokens.stylex'
import {
  BAR_ACROSS,
  FIGW,
  GRID_DOWN,
  PAD,
  R,
  badgeCount,
  badgeSize,
  barCellStart,
  barUnitStart,
  barUnitWidth,
  cellRun,
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
} from '@/lib/figures'
import { core, pickable, type FigProps } from './figure-core'
import { LineFig } from './figure-line'

const styles = stylex.create({
  fig: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  caption: {
    fontFamily: t.mono,
    fontSize: '12px',
    letterSpacing: '0.09em',
    color: t.mut,
  },
})

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
      {...stylex.props(core.svg, vert && core.upright)}
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
              core.cell,
              k < counted && core.cellOn,
              onPick && (k < counted ? core.cellPickOn : core.cellPick),
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
            {...stylex.props(core.frame)}
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
            {...stylex.props(core.badge, dark && core.badgeDark, pop?.badges && core.pop)}
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
          {...stylex.props(core.ring, badge !== 'units' && badges - 1 < counted && core.ringDark)}
        />
      )}
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
      {...stylex.props(core.svg)}
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
              core.cell,
              k < counted && core.cellOn,
              onPick && (k < counted ? core.cellPickOn : core.cellPick),
            )}
            onClick={onPick ? () => onPick(k + 1 === counted ? k : k + 1) : undefined}
            data-cuelume-press={onPick ? 'tick' : undefined}
          />
        )
      })}
      <rect x={PAD} y={PAD} width={across} height={GRID_DOWN - 2 * PAD} {...stylex.props(core.frame)} />
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
            {...stylex.props(core.badge, dark && core.badgeDark, pop?.badges && core.pop)}
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
          {...stylex.props(core.ring, badge !== 'units' && badges - 1 < counted && core.ringDark)}
        />
      )}
    </svg>
  )
}

type RoundLayout = 'grid' | 'grouped'

function RoundFig({
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
    <svg viewBox={`0 0 ${w} ${h}`} width={w} aria-hidden="true" {...stylex.props(core.svg)}>
      {Array.from({ length: fig.units }, (_, u) => {
        const cx = cxOf(u)
        const cy = cyOf(u)
        const ngon = (n: number) =>
          Array.from({ length: n }, (_, i) => `${sectorX(cx, i, n, r, tilt)},${sectorY(cy, i, n, r, tilt)}`).join(' ')
        if (fig.parts === 1) {
          if (sides < 3) return <circle key={u} cx={cx} cy={cy} r={r} {...stylex.props(core.cell)} />
          return <polygon key={u} points={ngon(sides)} {...stylex.props(core.cell)} />
        }
        return (
          <g key={u}>
            {Array.from({ length: fig.parts }, (_, s) => (
              <path
                key={s}
                d={wedgePath(cx, cy, r, sides, tilt, partOffset(fig, s), partOffset(fig, s + 1))}
                {...stylex.props(core.cell, u * fig.parts + s < counted && core.cellOn)}
              />
            ))}
            {sides < 3 ? (
              <circle cx={cx} cy={cy} r={r} {...stylex.props(core.frame)} />
            ) : (
              <polygon points={ngon(sides)} {...stylex.props(core.frame)} />
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
            {...stylex.props(core.badge, pop?.badges && core.pop)}
          >
            {u + 1}
          </text>
        ))}
      {badge === 'units' && badges > 0 && (
        <circle cx={cxOf(badges - 1)} cy={cyOf(badges - 1)} r={f} {...stylex.props(core.ring)} />
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
              {...stylex.props(core.badge, dark && core.badgeDark, pop?.badges && core.pop)}
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
          return <circle cx={p.x} cy={p.y - 0.35 * f} r={0.9 * f} {...stylex.props(core.ring, dark && core.ringDark)} />
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
