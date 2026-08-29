/* eslint-disable react-hooks/set-state-in-effect */

import * as stylex from '@stylexjs/stylex'
import type { StyleXStyles } from '@stylexjs/stylex'
import { play } from 'cuelume'
import { Fragment, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { createPortal, flushSync } from 'react-dom'
import { FigureView } from './figures-view'
import { badgeCount, morphs, turnsOnly } from '@/lib/figures'
import type { Figure } from '@/lib/figures'
import { clipKey, replayLesson, spokenLesson } from '@/lib/lesson'
import type { FracSlots, Lesson, TrialEntry } from '@/lib/lesson'
import { EnterKey, shellInert } from './ui'
import { chrome } from './chrome'
import { d, g, t } from '@/app/tokens.stylex'

const riseKf = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(16px)' },
})

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
  ldemo: {
    fontSize: '17px',
    lineHeight: 1.55,
    color: t.mut,
  },
  ldemoB: {
    color: t.ink,
    fontWeight: 620,
  },
  pcheckrow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '24px',
  },
  pfeed: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '13px',
    marginTop: '24px',
    paddingBlock: '18px',
    paddingInline: '20px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 16%, transparent)`,
    borderRadius: '14px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 4%, transparent)`,
    animationName: riseKf,
    animationDuration: '0.4s',
    animationTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
    animationFillMode: 'both',
  },
  feedBtn: {
    alignSelf: 'flex-end',
  },
  pverdict: {
    fontFamily: t.mono,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    paddingBlock: '5px',
    paddingInline: '12px',
    borderRadius: '999px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: g.gline,
    backgroundColor: d.gc,
    color: g.gon,
  },
  miss: {
    borderColor: `color-mix(in srgb, ${t.ink} 20%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${t.ink} 6%, transparent)`,
    color: t.mut,
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
  lfracrow: {
    display: 'flex',
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
  lfigs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    marginTop: '22px',
    viewTransitionName: 'learn-diagram',
  },
  lcc: {
    position: 'fixed',
    right: '18px',
    bottom: '58px',
    zIndex: 5,
    fontFamily: t.mono,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: t.mut,
    backgroundColor: `color-mix(in srgb, ${t.ink} 4%, ${t.void})`,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
    borderRadius: '10px',
    paddingBlock: '5px',
    paddingInline: '10px',
    boxShadow: {
      default: `0 3px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
      ':active': `0 1px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
    },
    cursor: 'pointer',
    transitionProperty: 'transform, box-shadow, color, border-color',
    transitionDuration: '0.12s, 0.12s, 0.18s, 0.18s',
    transitionTimingFunction: 'ease',
    transform: { default: null, ':active': 'translateY(2px)' },
  },
  lccOn: {
    color: t.ink,
    borderColor: `color-mix(in srgb, ${t.ink} 55%, transparent)`,
  },
})

function Words({ text, stack }: { text: string; stack?: StyleXStyles }) {
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

function LessonText({ text, bold, stack }: { text: string; bold?: StyleXStyles; stack?: StyleXStyles }) {
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

function FracBox({
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

type Feedback = { typed: string; correct: boolean }

const COUNT_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
] as const

export function scheduleCount(
  n: number,
  words: readonly (readonly [string, number])[],
  endMs: number,
): [number, number][] {
  const pending = Array.from({ length: n }, (_, i) => i + 1)
  const anchored = new Map<number, number>()
  let at = 0
  for (const k of pending) {
    const want = COUNT_WORDS[k - 1]
    if (want === undefined) continue
    for (let i = at; i < words.length; i++) {
      if (words[i][0].toLowerCase().replace(/[^a-z]/g, '') === want) {
        anchored.set(k, words[i][1])
        at = i + 1
        break
      }
    }
  }
  const out: [number, number][] = []
  let prev = 0
  let i = 0
  while (i < pending.length) {
    const k = pending[i]
    const a = anchored.get(k)
    if (a !== undefined) {
      prev = Math.max(a, prev)
      out.push([k, prev])
      i += 1
      continue
    }
    let j = i
    while (j < pending.length && !anchored.has(pending[j])) j += 1
    const bound = j < pending.length ? Math.max(anchored.get(pending[j])!, prev) : Math.max(endMs, prev)
    for (let q = i; q < j; q++) out.push([pending[q], prev + ((q - i + 1) * (bound - prev)) / (j - i + 1)])
    prev = out.length > 0 ? out[out.length - 1][1] : prev
    i = j
  }
  return out
}

function transitionDiagram(update: () => void, autoplay: boolean, turn = false): void {
  if (
    autoplay ||
    document.querySelector('[data-lfigs]') === null ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update()
    return
  }
  if (!turn) {
    document.startViewTransition(() => flushSync(update))
    return
  }
  document.documentElement.classList.add('learn-turn')
  const vt = document.startViewTransition(() => flushSync(update))
  vt.finished.finally(() => document.documentElement.classList.remove('learn-turn')).catch(() => undefined)
}

const AlignmentIndex = z.record(
  z.string(),
  z.object({ end: z.number(), words: z.array(z.tuple([z.string(), z.number()])) }),
)
type Alignment = z.infer<typeof AlignmentIndex>
let alignmentCache: Promise<Alignment> | null = null
function alignmentIndex(): Promise<Alignment> {
  alignmentCache ??= (async (): Promise<Alignment> => {
    try {
      const res = await fetch('/audio/lesson/alignment.json')
      const parsed = AlignmentIndex.safeParse(await res.json())
      if (res.ok && parsed.success) return parsed.data
    } catch {}
    alignmentCache = null
    return {}
  })()
  return alignmentCache
}

const CC_KEY = 'um.cc'

function loadCc(): boolean {
  try {
    return localStorage.getItem(CC_KEY) === '1'
  } catch {
    return false
  }
}

export function LessonPlayer({
  lesson,
  log,
  onTrial,
  auto = false,
}: {
  lesson: Lesson
  log: TrialEntry[]
  onTrial: (entry: TrialEntry) => void
  auto?: boolean
}) {
  const [typed, setTyped] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [free, setFree] = useState('')
  const [sel, setSel] = useState<number[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [cardKey, setCardKey] = useState(0)
  const [morphed, setMorphed] = useState(false)
  const [voiced, setVoiced] = useState(false)
  const [ccOn, setCcOn] = useState(loadCc)
  const [shown, setShown] = useState<number | null>(() => {
    const st = replayLesson(lesson, log).current
    const first = st ? lesson.items[st.item] : null
    return first && first.role === 'model' && first.figures?.length === 1 && first.count !== undefined ? 0 : null
  })
  const audRef = useRef<HTMLAudioElement | null>(null)
  const voiceOkRef = useRef(true)
  const state = replayLesson(lesson, log)
  const step = state.current
  const item = step ? lesson.items[step.item] : null
  const model = item?.role === 'model'
  const reveal = model || feedback !== null
  const figures = item?.figures ?? []
  const targets = item ? item.expected.split(/[\s/,]+/).map(Number) : []
  const fracSlots = item?.frac
    ? [...(item.frac.whole !== undefined ? [item.frac.whole] : []), item.frac.num, item.frac.den]
    : []
  const editable = fracSlots.filter((s) => s === null).length
  const filled = Array.from({ length: editable }, (_, i) => (slots[i] ?? '').trim())
  const canCheck = !item
    ? false
    : item.mode === 'typed'
      ? typed.trim() !== ''
      : item.mode === 'frac'
        ? filled.every((s) => s !== '') || free.trim() !== ''
        : figures.every((_, i) => (sel[i] ?? 0) > 0)

  const clear = () => {
    setTyped('')
    setSlots([])
    setFree('')
    setSel([])
  }
  const serialize = () =>
    item!.mode === 'typed'
      ? typed.trim()
      : item!.mode === 'frac'
        ? free.trim() !== ''
          ? free.trim()
          : filled.join('/')
        : sel.join(',')
  const bless = () => {
    const aud = audRef.current
    if (aud === null || voiceOkRef.current || aud.src === '') return
    aud.muted = true
    void aud
      .play()
      .then(() => aud.pause())
      .catch(() => undefined)
      .finally(() => {
        aud.muted = false
      })
  }
  const check = (answer: string) => {
    bless()
    const after = replayLesson(lesson, [...log, { typed: answer }])
    play(after.lastCorrect ? 'success' : 'error')
    transitionDiagram(() => setFeedback({ typed: answer, correct: after.lastCorrect === true }), auto)
  }
  const leave = (entry: TrialEntry) => {
    bless()
    const next = replayLesson(lesson, [...log, entry]).current
    const nextItem = next ? lesson.items[next.item] : null
    const nf = nextItem?.figures
    const nextShown =
      nextItem && nextItem.role === 'model' && nf?.length === 1 && nextItem.count !== undefined ? 0 : null
    if (morphs(figures, nf)) {
      clear()
      setFeedback(null)
      setMorphed(true)
      setShown(nextShown)
      onTrial(entry)
      return
    }
    transitionDiagram(
      () => {
        clear()
        setFeedback(null)
        setMorphed(false)
        setShown(nextShown)
        setCardKey((k) => k + 1)
        onTrial(entry)
      },
      auto,
      turnsOnly(figures, nf),
    )
  }
  const advance = () => leave({ typed: feedback!.typed })
  const advanceModel = () => leave({ typed: '' })

  const shownSlots = !reveal
    ? slots
    : feedback && !feedback.correct
      ? feedback.typed.split(/[\s/]+/)
      : item!.expected.split(/[\s/]+/)
  const shownSel = reveal ? targets : sel
  const countedFor = (fig: Figure, i: number) => (item!.mode === 'shade' ? (shownSel[i] ?? 0) : (fig.counted ?? 0))
  const interactive = item?.mode === 'shade' && !reveal

  const continueRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (feedback) continueRef.current?.focus()
  }, [feedback])

  const answerRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (item?.mode === 'typed' && !model && feedback === null) answerRef.current?.focus()
  }, [item, model, feedback])

  useEffect(() => {
    if (!item || auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVoiced(false)
      setShown(null)
      return
    }
    setVoiced(voiceOkRef.current)
    const fig = item.figures?.length === 1 ? item.figures[0] : undefined
    const counts = model && fig !== undefined && item.count !== undefined
    const total = counts ? badgeCount(item.count, fig, fig.counted ?? 0) : 0
    setShown(counts && voiceOkRef.current ? 0 : null)
    const texts = feedback ? [item.demo] : model ? [item.prompt, item.demo] : [item.prompt]
    const aud = (audRef.current ??= new Audio())
    aud.onended = null
    aud.pause()
    const timers: ReturnType<typeof setTimeout>[] = []
    let dead = false
    let at = 0
    const speak = () => {
      const text = texts[at]
      if (text === undefined) return
      const finale = at === texts.length - 1
      aud.src = `/audio/lesson/${clipKey(spokenLesson(text))}.mp3`
      aud.onended = () => {
        at += 1
        speak()
      }
      aud.play().then(
        () => {
          voiceOkRef.current = true
          setVoiced(true)
          if (counts && finale) {
            void alignmentIndex().then((index) => {
              if (dead) return
              const entry = index[clipKey(spokenLesson(text))]
              const endMs =
                entry?.end ?? (Number.isFinite(aud.duration) && aud.duration > 0 ? aud.duration * 1000 : total * 600)
              for (const [k, delay] of scheduleCount(total, entry?.words ?? [], endMs))
                timers.push(setTimeout(() => setShown(k), delay))
            })
          }
        },
        () => {
          voiceOkRef.current = false
          setVoiced(false)
          setShown(null)
        },
      )
    }
    speak()
    return () => {
      dead = true
      for (const timer of timers) clearTimeout(timer)
      aud.onended = null
      aud.pause()
    }
  }, [item, feedback, model, auto])

  useEffect(() => {
    if (!auto || state.done) return
    const timer = setTimeout(() => {
      if (feedback) advance()
      else if (model) advanceModel()
      else check(item!.expected)
    }, 130)
    return () => clearTimeout(timer)
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || shellInert()) return
      if (e.key === 'Enter' && !state.done) {
        e.preventDefault()
        if (feedback) advance()
        else if (model) advanceModel()
        else if (canCheck) check(serialize())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!item) return null

  const pickCell = (i: number) => (n: number) => {
    const next = [...sel]
    next[i] = n
    setSel(next)
  }
  const editSlot = (i: number, v: string) => {
    const next = [...slots]
    next[i] = v.replace(/\D/g, '')
    setSlots(next)
    setFree('')
  }
  const editFree = (v: string) => {
    setFree(v.replace(/[^\d/ ]/g, ''))
    setSlots([])
  }
  const spoken = voiced && !ccOn
  const demo = (
    <p {...stylex.props(styles.ldemo, spoken && chrome.voiced)} hidden={spoken}>
      <LessonText text={item.demo} bold={styles.ldemoB} />
    </p>
  )
  const setCc = (on: boolean) => {
    setCcOn(on)
    try {
      localStorage.setItem(CC_KEY, on ? '1' : '0')
    } catch {}
  }

  return (
    <>
      <div key={cardKey} {...stylex.props(chrome.pcard)}>
        <p {...stylex.props(chrome.pq, spoken && chrome.voiced)} hidden={spoken} aria-live="polite">
          <LessonText text={item.prompt} />
        </p>
        {figures.length > 0 && (
          <div {...stylex.props(styles.lfigs)} data-lfigs="">
            {figures.map((fig, i) => (
              <FigureView
                key={i}
                fig={fig}
                counted={countedFor(fig, i)}
                badge={reveal ? item.count : undefined}
                shown={shown ?? undefined}
                onPick={interactive ? pickCell(i) : undefined}
                label={fig.label && <LessonText text={fig.label} stack={styles.labelStack} />}
                pop={{ ticks: morphed, badges: morphed || shown !== null }}
              />
            ))}
          </div>
        )}
        {item.mode === 'frac' && (
          <div {...stylex.props(styles.lfracrow)}>
            {item.expr && (
              <span {...stylex.props(styles.lexpr)}>
                <LessonText text={item.expr} />
              </span>
            )}
            <FracBox
              frac={item.frac!}
              values={shownSlots}
              onChange={editSlot}
              disabled={reveal}
              tone={feedback ? (feedback.correct ? 'right' : 'wrong') : null}
            />
            {!reveal && (
              <span {...stylex.props(styles.lfree)}>
                <span {...stylex.props(styles.num)}>or type it</span>
                <input
                  {...stylex.props(styles.lfreeIn)}
                  type="text"
                  value={free}
                  onChange={(e) => editFree(e.target.value)}
                  placeholder="3/5"
                  aria-label="Fraction as text"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="done"
                />
                {free.trim() !== '' && <Words text={free} />}
              </span>
            )}
          </div>
        )}
        {item.mode === 'typed' && !model && (
          <input
            {...stylex.props(
              styles.pfillin,
              feedback !== null && (feedback.correct ? styles.pfillinRight : styles.pfillinWrong),
            )}
            type="text"
            value={feedback ? feedback.typed : typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={feedback !== null}
            placeholder="Type your answer"
            aria-label="Your answer"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            enterKeyHint="done"
            spellCheck={false}
            autoFocus
            ref={answerRef}
          />
        )}
        {model ? (
          <div {...stylex.props(styles.pfeed)}>
            {demo}
            <button
              {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, styles.feedBtn)}
              onClick={advanceModel}
              data-cuelume-press="press"
              data-cuelume-release="release"
            >
              Next
              <EnterKey />
            </button>
          </div>
        ) : feedback ? (
          <div {...stylex.props(styles.pfeed)} role="status">
            <p {...stylex.props(styles.pverdict, !feedback.correct && styles.miss)}>
              {feedback.correct ? 'correct' : 'not quite'}
            </p>
            {demo}
            <button
              ref={continueRef}
              {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, styles.feedBtn)}
              onClick={advance}
              data-cuelume-press="press"
              data-cuelume-release="release"
            >
              Continue
              <EnterKey />
            </button>
          </div>
        ) : (
          <div {...stylex.props(styles.pcheckrow)}>
            <span />
            <button
              {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary)}
              disabled={!canCheck}
              onClick={() => check(serialize())}
              data-cuelume-press="press"
              data-cuelume-release="release"
            >
              Check
              <EnterKey />
            </button>
          </div>
        )}
      </div>
      {createPortal(
        <button
          {...stylex.props(styles.lcc, ccOn && styles.lccOn)}
          aria-pressed={ccOn}
          aria-label="Captions"
          onClick={() => setCc(!ccOn)}
          data-cuelume-press="tick"
        >
          cc
        </button>,
        document.body,
      )}
    </>
  )
}
