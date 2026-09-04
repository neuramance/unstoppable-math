import * as stylex from '@stylexjs/stylex'
import type { StyleXStyles } from '@stylexjs/stylex'
import { Fragment, type RefObject } from 'react'
import { d, g, t } from '@/app/tokens.stylex'
import type { FracSlots, LessonItem } from '@/lib/lesson'
import type { useLessonAnswer } from './use-lesson-answer'

const styles = stylex.create({
  mfrac: {
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    fontWeight: 650,
  },
  mstack: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: '0.76em',
    lineHeight: 1.15,
  },
  mnum: {
    borderBottomWidth: '1.5px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'currentColor',
    paddingTop: 0,
    paddingInline: '4px',
    paddingBottom: '2px',
  },
  mden: {
    paddingTop: '1px',
  },
  labelStack: {
    fontSize: '1em',
  },
  lfrac: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
  },
  lstack: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
  },
  lbar: {
    width: '100%',
    minWidth: '48px',
    height: '2.5px',
    borderRadius: '1px',
    backgroundColor: t.accent,
  },
  lslot: {
    display: 'grid',
    placeItems: 'center',
    width: '60px',
    height: '44px',
    fontFamily: t.sans,
    fontSize: '24px',
    fontWeight: 700,
    textAlign: 'center',
    color: t.accent,
  },
  slotInput: {
    appearance: 'none',
    padding: 0,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.accent} 55%, transparent)`,
    borderRadius: '10px',
    backgroundColor: `color-mix(in srgb, ${t.accent} 6%, transparent)`,
    transitionProperty: 'border-color, background-color, opacity',
    transitionDuration: '0.16s',
    transitionTimingFunction: 'ease',
  },
  slotEmpty: {
    height: '22px',
  },
  slotRight: {
    backgroundColor: d.gc,
    borderColor: g.gline,
    color: g.gon,
  },
  lfracrow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    marginTop: '24px',
    fontSize: '22px',
  },
  lexpr: {
    fontFamily: t.sans,
    fontSize: '24px',
    fontWeight: 700,
    color: t.accent,
  },
  lfree: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
  },
  num: {
    fontFamily: t.mono,
    fontSize: '12px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: t.mut,
  },
  lfreeIn: {
    width: '7ch',
    paddingBlock: '9px',
    paddingInline: '12px',
    borderRadius: '10px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: {
      default: `color-mix(in srgb, ${t.ink} 22%, transparent)`,
      ':focus': `color-mix(in srgb, ${t.ink} 42%, transparent)`,
    },
    backgroundColor: `color-mix(in srgb, ${t.ink} 3%, transparent)`,
    color: t.ink,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontStyle: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    textAlign: 'center',
    outlineStyle: 'none',
  },
  pfillin: {
    appearance: 'none',
    width: '100%',
    marginTop: '20px',
    fontFamily: t.sans,
    fontSize: '17px',
    color: {
      default: t.ink,
      '::placeholder': `color-mix(in srgb, ${t.mut} 55%, transparent)`,
    },
    paddingBlock: '13px',
    paddingInline: '16px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 22%, transparent)`,
    borderRadius: '12px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 3%, transparent)`,
    boxShadow: `inset 0 2px 0 color-mix(in srgb, ${t.ink} 5%, transparent)`,
    transitionProperty: 'border-color, background-color, opacity',
    transitionDuration: '0.16s',
    transitionTimingFunction: 'ease',
  },
  pfillinRight: {
    backgroundColor: d.gc,
    borderColor: g.gline,
    color: g.gon,
  },
  pfillinWrong: {
    opacity: 0.5,
  },
  slotWrong: {
    opacity: 0.5,
  },
})

export const labelStack = styles.labelStack

export function Words({ text, stack }: { text: string; stack?: StyleXStyles }) {
  return (
    <>
      {text.split(/(\s+|-)/).map((w, i) => {
        const m = /^(\d+|▢)\/(\d+|▢)([?.,:;…]*)$/.exec(w)
        if (!m) return <Fragment key={i}>{w}</Fragment>
        return (
          <Fragment key={i}>
            <span {...stylex.props(styles.mfrac)} role="math" aria-label={`${m[1]}/${m[2]}`}>
              <span {...stylex.props(styles.mstack, stack)} aria-hidden="true">
                <span {...stylex.props(styles.mnum)}>{m[1]}</span>
                <span {...stylex.props(styles.mden)}>{m[2]}</span>
              </span>
            </span>
            {m[3]}
          </Fragment>
        )
      })}
    </>
  )
}

export function LessonText({ text, bold, stack }: { text: string; bold?: StyleXStyles; stack?: StyleXStyles }) {
  return (
    <>
      {text.split('*').map((seg, i) =>
        i % 2 ? (
          <b key={i} {...stylex.props(bold)}>
            <Words text={seg} stack={stack} />
          </b>
        ) : (
          <Fragment key={i}>
            <Words text={seg} stack={stack} />
          </Fragment>
        ),
      )}
    </>
  )
}

export function FracBox({
  frac,
  values,
  onChange,
  disabled,
  tone,
  answerRef,
}: {
  frac: FracSlots
  values: string[]
  onChange: (i: number, v: string) => void
  disabled: boolean
  tone: 'right' | 'wrong' | null
  answerRef?: RefObject<HTMLInputElement | null>
}) {
  const slot = (fixed: string | null, name: string, i: number) => {
    if (fixed !== null)
      return fixed === '' ? (
        <span {...stylex.props(styles.lslot, styles.slotEmpty)} />
      ) : (
        <span {...stylex.props(styles.lslot)}>{fixed}</span>
      )
    return (
      <input
        {...stylex.props(
          styles.lslot,
          styles.slotInput,
          tone === 'right' && styles.slotRight,
          tone === 'wrong' && styles.slotWrong,
        )}
        type="text"
        inputMode="numeric"
        value={values[i] ?? ''}
        onChange={(e) => onChange(i, e.target.value)}
        disabled={disabled}
        aria-label={name}
        autoComplete="off"
        ref={i === 0 ? answerRef : undefined}
      />
    )
  }
  const wholeInputs = frac.whole === null ? 1 : 0
  const numInputs = frac.num === null ? 1 : 0
  return (
    <span {...stylex.props(styles.lfrac)}>
      {frac.whole !== undefined && slot(frac.whole, 'units', 0)}
      <span {...stylex.props(styles.lstack)}>
        {slot(frac.num, 'numerator', wholeInputs)}
        <span {...stylex.props(styles.lbar)} />
        {slot(frac.den, 'denominator', wholeInputs + numInputs)}
      </span>
    </span>
  )
}

export function FracRow({
  item,
  answer,
  reveal,
  tone,
  answerRef,
}: {
  item: LessonItem
  answer: ReturnType<typeof useLessonAnswer>
  reveal: boolean
  tone: 'right' | 'wrong' | null
  answerRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <div {...stylex.props(styles.lfracrow)}>
      {item.expr && (
        <span {...stylex.props(styles.lexpr)}>
          <LessonText text={item.expr} />
        </span>
      )}
      <FracBox
        frac={item.frac!}
        values={answer.shownSlots}
        onChange={answer.editSlot}
        disabled={reveal}
        tone={tone}
        answerRef={answerRef}
      />
      {!reveal && (
        <span {...stylex.props(styles.lfree)}>
          <span {...stylex.props(styles.num)}>or type it</span>
          <input
            {...stylex.props(styles.lfreeIn)}
            type="text"
            value={answer.free}
            onChange={(e) => answer.editFree(e.target.value)}
            placeholder="3/5"
            aria-label="Fraction as text"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          {answer.free.trim() !== '' && <Words text={answer.free} />}
        </span>
      )}
    </div>
  )
}

export function TypedRow({
  value,
  onType,
  tone,
  answerRef,
}: {
  value: string
  onType: (v: string) => void
  tone: 'right' | 'wrong' | null
  answerRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <input
      {...stylex.props(
        styles.pfillin,
        tone === 'right' && styles.pfillinRight,
        tone === 'wrong' && styles.pfillinWrong,
      )}
      type="text"
      value={value}
      onChange={(e) => onType(e.target.value)}
      disabled={tone !== null}
      placeholder="Type your answer"
      aria-label="Your answer"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      enterKeyHint="done"
      spellCheck={false}
      ref={answerRef}
    />
  )
}
