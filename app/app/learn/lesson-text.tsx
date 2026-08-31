import * as stylex from '@stylexjs/stylex'
import type { StyleXStyles } from '@stylexjs/stylex'
import { Fragment } from 'react'
import { d, g, t } from '@/app/tokens.stylex'
import type { FracSlots } from '@/lib/lesson'

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
  slotWrong: {
    opacity: 0.5,
  },
})

export const labelStack = styles.labelStack

export function Words({ text, stack }: { text: string; stack?: StyleXStyles }) {
  return (
    <>
      {text.split(/(\s+)/).map((w, i) => {
        const m = /^(\d+)\/(\d+)([?.,:;]*)$/.exec(w)
        if (!m) return <Fragment key={i}>{w}</Fragment>
        return (
          <Fragment key={i}>
            <span {...stylex.props(styles.mfrac)}>
              <span {...stylex.props(styles.mstack, stack)}>
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
}: {
  frac: FracSlots
  values: string[]
  onChange: (i: number, v: string) => void
  disabled: boolean
  tone: 'right' | 'wrong' | null
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
        autoFocus={i === 0}
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
