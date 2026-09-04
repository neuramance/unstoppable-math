import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { fractionValue } from '@/lib/lesson'
import { t } from '@/app/tokens.stylex'
import { chrome } from './chrome'

const styles = stylex.create({
  plot: { display: 'block', width: '100%', marginTop: '20px', overflow: 'visible' },
  axis: { stroke: t.accent, strokeWidth: 2 },
  point: { fill: t.accent },
  label: { fill: t.ink, fontFamily: t.sans, fontSize: '16px' },
})

export function FractionNumberLine({ fractions }: { fractions: string[] }) {
  const [zoomed, setZoomed] = useState(false)
  const values = fractions.map(fractionValue)
  const low = Math.floor(Math.min(...values))
  const high = Math.max(low + 1, Math.ceil(Math.max(...values)))
  const from = zoomed ? low : 0
  const to = zoomed ? high : 10
  const axis = fractions.length * 30 + 20
  const x = (value: number) => `${4 + ((value - from) / (to - from)) * 92}%`
  return (
    <>
      <svg
        height={axis + 32}
        {...stylex.props(styles.plot)}
        role="img"
        aria-label={`Number line from ${from === 0 ? 'zero' : from} to ${to === 10 ? 'ten' : to} showing ${fractions.join(', ')}`}
      >
        <line x1={x(from)} x2={x(to)} y1={axis} y2={axis} {...stylex.props(styles.axis)} />
        {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((value) => (
          <g key={value}>
            <line x1={x(value)} x2={x(value)} y1={axis - 5} y2={axis + 5} {...stylex.props(styles.axis)} />
            <text x={x(value)} y={axis + 24} textAnchor="middle" {...stylex.props(styles.label)}>
              {value}
            </text>
          </g>
        ))}
        {fractions.map((fraction, i) => {
          const position = x(values[i])
          const height = 20 + i * 30
          return (
            <g key={i}>
              <line x1={position} x2={position} y1={height + 5} y2={axis} {...stylex.props(styles.axis)} />
              <circle cx={position} cy={axis} r={5} {...stylex.props(styles.point)} />
              <text
                x={position}
                y={height}
                textAnchor={values[i] > from + (to - from) * 0.5 ? 'end' : 'start'}
                {...stylex.props(styles.label)}
              >
                {fraction}
              </text>
            </g>
          )
        })}
      </svg>
      {high - low < 10 && (
        <button {...stylex.props(chrome.pill)} aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>
          {zoomed ? 'Show 0 to 10' : 'Zoom in on the fractions'}
        </button>
      )}
    </>
  )
}
