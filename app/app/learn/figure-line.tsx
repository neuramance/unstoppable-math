import * as stylex from '@stylexjs/stylex'
import { t } from '@/app/tokens.stylex'
import {
  LINE_ACROSS,
  PAD,
  UNIT_MARK_BAR,
  UNIT_MARK_BAR_HALF,
  UNIT_MARK_DROP,
  UNIT_MARK_RISE,
  badgeCount,
  badgeSize,
  cellRun,
  cellStart,
  cellWidth,
  figX,
  figY,
  longSpan,
  orientationOf,
  unitMarkRoom,
  unitMarkText,
  unitWidth,
} from '@/lib/figures'
import { core, pickable, type FigProps } from './figure-core'

const popKf = stylex.keyframes({
  from: { opacity: 0, transform: 'scale(0.75)' },
})

const REDUCE = '@media (prefers-reduced-motion: reduce)'

const styles = stylex.create({
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
})

export function LineFig({ fig, counted, badge, shown, onPick, pop }: FigProps) {
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
      {...stylex.props(core.svg, vert && core.upright)}
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
            {...stylex.props(unit ? styles.axis : styles.tick, !unit && pop?.ticks && core.pop)}
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
            {...stylex.props(core.badge, pop?.badges && core.pop)}
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
            {...stylex.props(core.ring)}
          />
        ) : (
          <circle
            cx={figX(badgeAlong(badges - 1), 20 + room, span, vert)}
            cy={figY(badgeAlong(badges - 1), 20 + room, span, vert) - 0.3 * f}
            r={0.8 * f}
            {...stylex.props(core.ring)}
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
