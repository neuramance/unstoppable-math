import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { LessonItem } from '@/lib/lesson'
import { FracBox, LessonText } from './lesson-text'

const styles = stylex.create({
  sums: { display: 'grid', gap: '24px', marginTop: '24px' },
  sum: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
})

export function DecomposeAnswer({
  item,
  reveal,
  onChange,
}: {
  item: Extract<LessonItem, { mode: 'decompose' }>
  reveal: boolean
  onChange: (answer: string) => void
}) {
  const [values, setValues] = useState<string[][]>(() => item.expected.split(';').map(() => ['', '']))
  const denominator = item.expr.split('/')[1]
  const edit = (row: number, column: number, value: string) => {
    const next = values.map((pair, i) => (i === row ? pair.map((n, j) => (j === column ? value : n)) : pair))
    setValues(next)
    onChange(next.flat().every((n) => n.trim() !== '') ? next.map((pair) => pair.join(' ')).join(';') : '')
  }
  return (
    <div {...stylex.props(styles.sums)}>
      {values.map((pair, row) => (
        <div key={row} role="group" aria-label={`Sum ${row + 1}`} {...stylex.props(styles.sum)}>
          <LessonText text={`${item.expr} =`} />
          <FracBox
            frac={{ num: null, den: denominator }}
            values={[pair[0]]}
            onChange={(_, value) => edit(row, 0, value)}
            disabled={reveal}
            tone={null}
          />
          <span>+</span>
          <FracBox
            frac={{ num: null, den: denominator }}
            values={[pair[1]]}
            onChange={(_, value) => edit(row, 1, value)}
            disabled={reveal}
            tone={null}
          />
        </div>
      ))}
    </div>
  )
}
