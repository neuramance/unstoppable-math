import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { LessonItem } from '@/lib/lesson'
import { MAX_PARTS } from '@/lib/figures'
import { t } from '@/app/tokens.stylex'
import { FigureView } from './figures-view'
import { LessonText } from './lesson-text'

const styles = stylex.create({
  task: { display: 'grid', gap: '24px', marginTop: '24px' },
  diagram: { display: 'grid', gap: '12px', minWidth: 0 },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' },
  select: {
    padding: '8px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: t.mut,
    backgroundColor: t.void,
    color: t.ink,
    fontFamily: 'inherit',
    fontSize: '16px',
  },
  choices: { borderWidth: 0, padding: 0, margin: 0 },
})

type Diagram = { parts: number; counted: number }

export function ConstructAnswer({
  item,
  reveal,
  onChange,
}: {
  item: Extract<LessonItem, { mode: 'construct' }>
  reveal: boolean
  onChange: (answer: string) => void
}) {
  const targets = item.figures
  const [diagrams, setDiagrams] = useState<Diagram[]>(targets.map(() => ({ parts: 1, counted: 0 })))
  const [equivalent, setEquivalent] = useState('')
  const update = (next: Diagram[], verdict: string) => {
    setDiagrams(next)
    setEquivalent(verdict)
    onChange(verdict === '' ? '' : `${next.flatMap((d) => [d.parts, d.counted]).join(' ')} ${verdict}`)
  }
  const displayed = reveal ? targets.map((f) => ({ parts: f.parts, counted: f.counted })) : diagrams
  const verdict = reveal ? item.expected.split(' ').at(-1) : equivalent
  return (
    <div {...stylex.props(styles.task)}>
      {targets.map((target, i) => (
        <div key={i} {...stylex.props(styles.diagram)}>
          <div {...stylex.props(styles.controls)}>
            <LessonText text={target.label} />
            <label>
              Equal parts{' '}
              <select
                {...stylex.props(styles.select)}
                aria-label={`Equal parts in diagram ${i + 1}`}
                value={displayed[i].parts}
                disabled={reveal}
                onChange={(e) =>
                  update(
                    diagrams.map((d, index) => (index === i ? { parts: Number(e.target.value), counted: 0 } : d)),
                    equivalent,
                  )
                }
              >
                {Array.from({ length: MAX_PARTS }, (_, n) => (
                  <option key={n} value={n + 1}>
                    {n + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FigureView
            fig={{ kind: 'bar', units: 1, parts: displayed[i].parts }}
            counted={displayed[i].counted}
            onPick={
              reveal
                ? undefined
                : (counted) =>
                    update(
                      diagrams.map((d, index) => (index === i ? { ...d, counted } : d)),
                      equivalent,
                    )
            }
          />
        </div>
      ))}
      <fieldset {...stylex.props(styles.choices)} disabled={reveal}>
        <legend>Are the fractions equivalent?</legend>
        <div {...stylex.props(styles.controls)}>
          {['yes', 'no'].map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name="equivalent"
                value={choice}
                checked={verdict === choice}
                onChange={() => update(diagrams, choice)}
              />{' '}
              {choice === 'yes' ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
