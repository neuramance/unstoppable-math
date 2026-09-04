import * as stylex from '@stylexjs/stylex'
import { play } from 'cuelume'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { d, g, t } from '@/app/tokens.stylex'
import { morphs, turnsOnly } from '@/lib/figures'
import type { Figure } from '@/lib/figures'
import { heardAnswer, replayLesson } from '@/lib/lesson'
import type { Lesson, LessonItem, TrialEntry } from '@/lib/lesson'
import { chrome } from './chrome'
import { FigureView } from './figures-view'
import { ConstructAnswer } from './construct-answer'
import { ShadeFractionAnswer } from './shade-fraction-answer'
import { FractionNumberLine } from './fraction-number-line'
import { ChoiceAnswer } from './choice-answer'
import { DecomposeAnswer } from './decompose-answer'
import { LineFractionsAnswer } from './line-fractions-answer'
import { FracRow, labelStack, LessonText, TypedRow } from './lesson-text'
import { Heard, MicPill } from './speech-row'
import { EnterKey, enterHotkey, reduced, shellInert } from './ui'
import { useLessonAnswer } from './use-lesson-answer'
import { initialShown, useLessonVoice } from './use-lesson-voice'
import { useSpeechAnswer } from './use-speech-answer'

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
  lfigs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    marginTop: '22px',
    viewTransitionName: 'learn-diagram',
  },
  lbar: {
    position: 'fixed',
    right: '18px',
    bottom: '58px',
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
})

type Feedback = { typed: string; correct: boolean }

function toneOf(feedback: Feedback | null): 'right' | 'wrong' | null {
  if (feedback === null) return null
  return feedback.correct ? 'right' : 'wrong'
}

function AnswerFields({
  item,
  answer,
  feedback,
  answerRef,
  trial,
}: {
  item: LessonItem
  answer: ReturnType<typeof useLessonAnswer>
  feedback: Feedback | null
  answerRef: RefObject<HTMLInputElement | null>
  trial: number
}) {
  const reveal = item.role === 'model' || feedback !== null
  const tone = toneOf(feedback)
  if (item.mode === 'choice')
    return <ChoiceAnswer item={item} value={answer.typed} reveal={reveal} onChange={answer.setTyped} />
  if (item.mode === 'decompose')
    return <DecomposeAnswer key={trial} item={item} reveal={reveal} onChange={answer.setTyped} />
  if (item.mode === 'line-fractions')
    return <LineFractionsAnswer key={trial} item={item} reveal={reveal} onChange={answer.setTyped} />
  if (item.mode === 'construct')
    return <ConstructAnswer key={trial} item={item} reveal={reveal} onChange={answer.setTyped} />
  if (item.mode === 'shade-fraction')
    return <ShadeFractionAnswer key={trial} item={item} reveal={reveal} onChange={answer.setTyped} />
  if (item.mode === 'frac')
    return <FracRow item={item} answer={answer} reveal={reveal} tone={tone} answerRef={answerRef} />
  if (item.mode === 'typed' && item.role === 'test')
    return (
      <TypedRow
        value={feedback ? feedback.typed : answer.typed}
        onType={answer.setTyped}
        tone={tone}
        answerRef={answerRef}
      />
    )
  return null
}

function answerableAloud(item: LessonItem | null, feedback: Feedback | null, auto: boolean): boolean {
  return item !== null && item.role === 'test' && ['typed', 'frac'].includes(item.mode) && feedback === null && !auto
}

function FigureRow({
  item,
  answer,
  reveal,
  shown,
  morphed,
}: {
  item: LessonItem
  answer: ReturnType<typeof useLessonAnswer>
  reveal: boolean
  shown: number | null
  morphed: boolean
}) {
  const figures = item.figures ?? []
  const interactive = item.mode === 'shade' && !reveal
  const countedFor = (fig: Figure, i: number) =>
    item.mode === 'shade' ? (answer.shownSel[i] ?? 0) : (fig.counted ?? 0)
  if (figures.length === 0 || !['typed', 'frac', 'shade', 'choice'].includes(item.mode)) return null
  return (
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
  )
}

function LessonFooter({
  model,
  feedback,
  demoText,
  spoken,
  canCheck,
  continueRef,
  onNext,
  onContinue,
  onCheck,
}: {
  model: boolean
  feedback: Feedback | null
  demoText: string
  spoken: boolean
  canCheck: boolean
  continueRef: RefObject<HTMLButtonElement | null>
  onNext: () => void
  onContinue: () => void
  onCheck: () => void
}) {
  const demo = (
    <p {...stylex.props(styles.ldemo, spoken && chrome.voiced)} hidden={spoken}>
      <LessonText text={demoText} bold={styles.ldemoB} />
    </p>
  )
  if (model)
    return (
      <div {...stylex.props(styles.pfeed)}>
        {demo}
        <button
          {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, styles.feedBtn)}
          onClick={onNext}
          data-cuelume-press="press"
          data-cuelume-release="release"
        >
          Next
          <EnterKey />
        </button>
      </div>
    )
  if (feedback)
    return (
      <div {...stylex.props(styles.pfeed)} role="status">
        <p {...stylex.props(styles.pverdict, !feedback.correct && styles.miss)}>
          {feedback.correct ? 'correct' : 'not quite'}
        </p>
        {demo}
        <button
          ref={continueRef}
          {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, styles.feedBtn)}
          onClick={onContinue}
          data-cuelume-press="press"
          data-cuelume-release="release"
        >
          Continue
          <EnterKey />
        </button>
      </div>
    )
  return (
    <div {...stylex.props(styles.pcheckrow)}>
      <span />
      <button
        {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary)}
        disabled={!canCheck}
        onClick={onCheck}
        data-cuelume-press="press"
        data-cuelume-release="release"
      >
        Check
        <EnterKey />
      </button>
    </div>
  )
}

function transitionDiagram(update: () => void, autoplay: boolean, turn = false): void {
  if (
    autoplay ||
    document.querySelector('[data-lfigs]') === null ||
    typeof document.startViewTransition !== 'function' ||
    reduced()
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

function LessonBar({
  muted,
  onMuted,
  ccOn,
  onCc,
  micSupported,
  micOn,
  onMic,
}: {
  muted: boolean
  onMuted: (next: boolean) => void
  ccOn: boolean
  onCc: (next: boolean) => void
  micSupported: boolean
  micOn: boolean
  onMic: (next: boolean) => void
}) {
  return createPortal(
    <div {...stylex.props(styles.lbar)}>
      {micSupported && <MicPill on={micOn} onMic={onMic} />}
      <button
        {...stylex.props(chrome.pill, muted && chrome.pillOn)}
        aria-pressed={muted}
        aria-label="Mute"
        onClick={() => onMuted(!muted)}
        data-cuelume-press="tick"
      >
        {muted ? 'muted' : 'mute'}
      </button>
      <button
        {...stylex.props(chrome.pill, ccOn && chrome.pillOn)}
        aria-pressed={ccOn}
        aria-label="Captions"
        onClick={() => onCc(!ccOn)}
        data-cuelume-press="tick"
      >
        cc
      </button>
    </div>,
    document.body,
  )
}

export function LessonPlayer({
  lesson,
  log,
  onTrial,
  onAdvance,
  auto = false,
  muted = false,
  onMuted,
}: {
  lesson: Lesson
  log: TrialEntry[]
  onTrial: (entry: TrialEntry) => void
  onAdvance: () => void
  auto?: boolean
  muted?: boolean
  onMuted: (next: boolean) => void
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [cardKey, setCardKey] = useState(0)
  const [morphed, setMorphed] = useState(false)
  const interaction = useRef<'ready' | 'checked' | 'advancing'>('ready')
  const state = replayLesson(lesson, log)
  const step = state.current
  const item = step ? lesson.items[step.item] : null
  const model = item?.role === 'model'
  const reveal = model || feedback !== null
  const voice = useLessonVoice(lesson, log, item, feedback !== null, model, auto, muted)
  const { shown, spoken } = voice
  const answer = useLessonAnswer(item, feedback && !feedback.correct ? feedback.typed : null, reveal)
  const figures = item?.figures ?? []

  const check = (typed: string) => {
    if (interaction.current !== 'ready') return
    interaction.current = 'checked'
    voice.bless()
    const after = replayLesson(lesson, [...log, { typed }])
    onTrial({ typed })
    play(after.lastCorrect ? 'success' : 'error')
    transitionDiagram(() => setFeedback({ typed, correct: after.lastCorrect === true }), auto)
  }
  const leave = (entry: TrialEntry) => {
    if (interaction.current === 'advancing') return
    interaction.current = 'advancing'
    voice.bless()
    if (model) onTrial(entry)
    const next = replayLesson(lesson, [...log, entry]).current
    const nextItem = next ? lesson.items[next.item] : null
    const nf = nextItem?.figures
    const nextShown = initialShown(nextItem)
    const convert = morphs(figures, nf)
    const update = () => {
      answer.clear()
      setFeedback(null)
      setMorphed(convert)
      voice.setShown(nextShown)
      if (!convert) setCardKey((k) => k + 1)
      onAdvance()
      interaction.current = 'ready'
    }
    if (convert) update()
    else transitionDiagram(update, auto, turnsOnly(figures, nf))
  }
  const advance = () => leave({ typed: feedback!.typed })
  const advanceModel = () => leave({ typed: '' })

  const speech = useSpeechAnswer(answerableAloud(item, feedback, auto) && !voice.audible, (said) => {
    if (shellInert() || document.hidden) return
    check(heardAnswer(item!, said))
  })

  const continueRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (feedback) continueRef.current?.focus()
  }, [feedback])

  const answerRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!model && feedback === null) answerRef.current?.focus()
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
      if (!enterHotkey(e) || state.done) return
      e.preventDefault()
      if (feedback) advance()
      else if (model) advanceModel()
      else if (answer.canCheck) check(answer.serialize())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!item) return null

  return (
    <>
      <div key={cardKey} {...stylex.props(chrome.pcard)}>
        <p {...stylex.props(chrome.pq, spoken && chrome.voiced)} hidden={spoken} aria-live="polite">
          <LessonText text={item.prompt} />
        </p>
        <FigureRow item={item} answer={answer} reveal={reveal} shown={shown} morphed={morphed} />
        {item.numberLine && <FractionNumberLine key={log.length} fractions={item.numberLine} />}
        <AnswerFields item={item} answer={answer} feedback={feedback} answerRef={answerRef} trial={log.length} />
        <Heard listening={speech.listening} interim={speech.interim} />
        <LessonFooter
          model={model}
          feedback={feedback}
          demoText={item.demo}
          spoken={spoken}
          canCheck={answer.canCheck}
          continueRef={continueRef}
          onNext={advanceModel}
          onContinue={advance}
          onCheck={() => check(answer.serialize())}
        />
      </div>
      <LessonBar
        muted={muted}
        onMuted={onMuted}
        ccOn={voice.ccOn}
        onCc={voice.setCc}
        micSupported={speech.supported}
        micOn={speech.on}
        onMic={speech.setMic}
      />
    </>
  )
}
