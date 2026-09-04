import * as stylex from '@stylexjs/stylex'
import { t } from '@/app/tokens.stylex'
import type { LessonItem } from '@/lib/lesson'
import { LessonText } from './lesson-text'

const styles = stylex.create({
  choices: { display: 'grid', gap: '12px', borderWidth: 0, marginTop: '20px', padding: 0 },
  legend: { marginBottom: '12px', color: t.mut },
  option: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    padding: '14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: t.mut,
    borderRadius: '10px',
    lineHeight: 1.5,
  },
})

export function ChoiceAnswer({
  item,
  value,
  reveal,
  onChange,
}: {
  item: Extract<LessonItem, { mode: 'choice' }>
  value: string
  reveal: boolean
  onChange: (value: string) => void
}) {
  return (
    <fieldset {...stylex.props(styles.choices)} disabled={reveal}>
      <legend {...stylex.props(styles.legend)}>Choose the best answer.</legend>
      {item.choices.map((choice) => (
        <label key={choice} {...stylex.props(styles.option)}>
          <input
            type="radio"
            name="answer"
            aria-label={choice}
            checked={value === choice}
            onChange={() => onChange(choice)}
          />
          <span>
            <LessonText text={choice} />
          </span>
        </label>
      ))}
    </fieldset>
  )
}
