import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { LessonItem } from '@/lib/lesson'
import { t } from '@/app/tokens.stylex'
import { FracBox } from './lesson-text'

const styles = stylex.create({
  scroll: { overflowX: 'auto', marginTop: '24px' },
  canvas: (width: number) => ({ minWidth: width }),
  fractions: { display: 'flex', justifyContent: 'space-around' },
  line: { display: 'block', width: '100%' },
  tick: { stroke: t.accent, strokeWidth: 2 },
  label: { fill: t.ink, fontFamily: t.sans, fontSize: '16px' },
})

export function LineFractionsAnswer({
  item,
  reveal,
  onChange,
}: {
  item: Extract<LessonItem, { mode: 'line-fractions' }>
  reveal: boolean
  onChange: (answer: string) => void
}) {
  const { units, parts } = item.figures[0]
  const [values, setValues] = useState<string[]>(() => Array(units + 1).fill(''))
  const width = (units + 1) * 76
  const x = (position: number) => 38 + position * 76
  const edit = (index: number, value: string) => {
    const next = values.map((n, i) => (i === index ? value : n))
    setValues(next)
    onChange(next.every((n) => n.trim() !== '') ? next.join(' ') : '')
  }
  return (
    <div {...stylex.props(styles.scroll)} tabIndex={0} aria-label="Fraction labels on the number line">
      <div {...stylex.props(styles.canvas(width))}>
        <div {...stylex.props(styles.fractions)}>
          {values.map((value, unit) => (
            <div key={unit} role="group" aria-label={`At ${unit}`}>
              <FracBox
                frac={item.blank === 'numerator' ? { num: null, den: String(parts) } : { num: '▢', den: null }}
                values={[value]}
                onChange={(_, next) => edit(unit, next)}
                disabled={reveal}
                tone={null}
              />
            </div>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${width} 64`}
          {...stylex.props(styles.line)}
          role="img"
          aria-label={`${units} whole units, ${parts} parts per unit`}
        >
          <line x1={x(0)} x2={x(units)} y1={20} y2={20} {...stylex.props(styles.tick)} />
          {Array.from({ length: units * parts + 1 }, (_, k) => (
            <line
              key={k}
              x1={x(k / parts)}
              x2={x(k / parts)}
              y1={k % parts === 0 ? 10 : 15}
              y2={k % parts === 0 ? 30 : 25}
              {...stylex.props(styles.tick)}
            />
          ))}
          {values.map((_, unit) => (
            <text key={unit} x={x(unit)} y={54} textAnchor="middle" {...stylex.props(styles.label)}>
              {unit}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
