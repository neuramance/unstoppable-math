import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { LessonItem } from '@/lib/lesson'
import { FigureView } from './figures-view'
import { FracBox, LessonText } from './lesson-text'

const styles = stylex.create({
  task: { display: 'grid', gap: '20px', marginTop: '24px' },
  equation: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
})

export function ShadeFractionAnswer({
  item,
  reveal,
  onChange,
}: {
  item: Extract<LessonItem, { mode: 'shade-fraction' }>
  reveal: boolean
  onChange: (answer: string) => void
}) {
  const [counted, setCounted] = useState(0)
  const [numerator, setNumerator] = useState('')
  const figure = item.figures[0]
  const update = (shaded: number, value: string) => {
    setCounted(shaded)
    setNumerator(value)
    onChange(value.trim() === '' ? '' : `${shaded} ${value.trim()}`)
  }
  return (
    <div {...stylex.props(styles.task)}>
      <FigureView
        fig={figure}
        counted={reveal ? figure.counted : counted}
        onPick={reveal ? undefined : (n) => update(n, numerator)}
      />
      <div {...stylex.props(styles.equation)}>
        <LessonText text={item.expr} />
        <FracBox
          frac={{ num: null, den: String(figure.parts) }}
          values={[reveal ? String(figure.counted) : numerator]}
          onChange={(_, value) => update(counted, value)}
          disabled={reveal}
          tone={null}
        />
      </div>
    </div>
  )
}
