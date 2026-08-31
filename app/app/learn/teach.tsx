import * as stylex from '@stylexjs/stylex'
import { play } from 'cuelume'
import { useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { d, g, t } from '@/app/tokens.stylex'
import { morphs, turnsOnly } from '@/lib/figures'
import type { Figure } from '@/lib/figures'
import { replayLesson } from '@/lib/lesson'
import type { Lesson, TrialEntry } from '@/lib/lesson'
import { chrome } from './chrome'
import { FigureView } from './figures-view'
import { FracBox, labelStack, LessonText, Words } from './lesson-text'
import { EnterKey, shellInert } from './ui'
import { useLessonAnswer } from './use-lesson-answer'
import { initialShown, useLessonVoice } from './use-lesson-voice'

const riseKf = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(16px)' },
})

const styles = stylex.create({
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

type Feedback = { typed: string; correct: boolean }

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
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [cardKey, setCardKey] = useState(0)
  const [morphed, setMorphed] = useState(false)
  const state = replayLesson(lesson, log)
  const step = state.current
  const item = step ? lesson.items[step.item] : null
  const model = item?.role === 'model'
  const reveal = model || feedback !== null
  const voice = useLessonVoice(lesson, log, item, feedback !== null, model, auto)
  const { shown } = voice
  const answer = useLessonAnswer(item, feedback && !feedback.correct ? feedback.typed : null, reveal)
  const figures = item?.figures ?? []

  const check = (typed: string) => {
    voice.bless()
    const after = replayLesson(lesson, [...log, { typed }])
    play(after.lastCorrect ? 'success' : 'error')
    transitionDiagram(() => setFeedback({ typed, correct: after.lastCorrect === true }), auto)
  }
  const leave = (entry: TrialEntry) => {
    voice.bless()
    const next = replayLesson(lesson, [...log, entry]).current
    const nextItem = next ? lesson.items[next.item] : null
    const nf = nextItem?.figures
    const nextShown = initialShown(nextItem)
    if (morphs(figures, nf)) {
      answer.clear()
      setFeedback(null)
      setMorphed(true)
      voice.setShown(nextShown)
      onTrial(entry)
      return
    }
    transitionDiagram(
      () => {
        answer.clear()
        setFeedback(null)
        setMorphed(false)
        voice.setShown(nextShown)
        setCardKey((k) => k + 1)
        onTrial(entry)
      },
      auto,
      turnsOnly(figures, nf),
    )
  }
  const advance = () => leave({ typed: feedback!.typed })
  const advanceModel = () => leave({ typed: '' })

  const countedFor = (fig: Figure, i: number) =>
    item!.mode === 'shade' ? (answer.shownSel[i] ?? 0) : (fig.counted ?? 0)
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
        else if (answer.canCheck) check(answer.serialize())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!item) return null

  const spoken = voice.voiced && !voice.ccOn
  const demo = (
    <p {...stylex.props(styles.ldemo, spoken && chrome.voiced)} hidden={spoken}>
      <LessonText text={item.demo} bold={styles.ldemoB} />
    </p>
  )

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
                onPick={interactive ? answer.pickCell(i) : undefined}
                label={fig.label && <LessonText text={fig.label} stack={labelStack} />}
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
              values={answer.shownSlots}
              onChange={answer.editSlot}
              disabled={reveal}
              tone={feedback ? (feedback.correct ? 'right' : 'wrong') : null}
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
        )}
        {item.mode === 'typed' && !model && (
          <input
            {...stylex.props(
              styles.pfillin,
              feedback !== null && (feedback.correct ? styles.pfillinRight : styles.pfillinWrong),
            )}
            type="text"
            value={feedback ? feedback.typed : answer.typed}
            onChange={(e) => answer.setTyped(e.target.value)}
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
              disabled={!answer.canCheck}
              onClick={() => check(answer.serialize())}
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
          {...stylex.props(styles.lcc, voice.ccOn && styles.lccOn)}
          aria-pressed={voice.ccOn}
          aria-label="Captions"
          onClick={() => voice.setCc(!voice.ccOn)}
          data-cuelume-press="tick"
        >
          cc
        </button>,
        document.body,
      )}
    </>
  )
}
