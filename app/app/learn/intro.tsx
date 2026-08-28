import * as stylex from '@stylexjs/stylex'
import { useEffect, useRef, useState } from 'react'

const SEEN_KEY = 'um.intro-seen'
const INTRO_SRC = '/intro/intro.mp4'

const TITLE_IN = 0.404
const TITLE_THROUGH = 0.617
const ARRIVE = 0.96

const MARK_WIDTH = 0.62
const BLOCK_CENTRE = 0.5

const BUFFER_BUDGET_MS = 6000
const EXIT_MS = 900

const TAIL_LUMA = 246

export function srgbLuma(r: number, g: number, b: number) {
  console.assert(r >= 0)
  console.assert(r <= 255)
  console.assert(g >= 0)
  console.assert(g <= 255)
  console.assert(b >= 0)
  console.assert(b <= 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function exitBrightness(pageLuma: number) {
  console.assert(pageLuma >= 0)
  console.assert(pageLuma <= 255)
  return Math.min(1.1, Math.max(0.02, pageLuma / TAIL_LUMA))
}

export function coverFrameWidth(ratio: number, winW: number, winH: number) {
  console.assert(ratio > 0.2)
  console.assert(ratio < 5)
  console.assert(winW >= 1)
  console.assert(winH >= 1)
  return winW / winH < ratio ? winH * ratio : winW
}

export function coverFrameHeight(ratio: number, winW: number, winH: number) {
  console.assert(ratio > 0.2)
  console.assert(ratio < 5)
  console.assert(winW >= 1)
  console.assert(winH >= 1)
  return winW / winH < ratio ? winH : winW / ratio
}

function pageLuma(): number {
  const bg = getComputedStyle(document.body).backgroundColor
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(bg)
  if (m === null) return TAIL_LUMA
  return srgbLuma(Number(m[1]), Number(m[2]), Number(m[3]))
}

export function introPending(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {}
}

const markFormKf = stylex.keyframes({
  from: {
    transform: 'scale(0.26)',
    maskSize: '30% 90%',
    filter: 'blur(9px) brightness(0.16) contrast(1.6) saturate(0.15)',
  },
  '55%': {
    filter: 'blur(3px) brightness(0.7) contrast(1.2) saturate(0.7)',
  },
  to: {
    transform: 'scale(1)',
    maskSize: '400% 400%',
    filter: 'blur(0) brightness(1) contrast(1) saturate(1)',
  },
})

const settleKf = stylex.keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(-50%) scale(1.09)',
    filter: 'blur(13px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(-50%) scale(1)',
    filter: 'blur(0)',
  },
})

const throughKf = stylex.keyframes({
  from: {
    opacity: 1,
    transform: 'translateY(-50%) scale(1)',
    filter: 'blur(0)',
  },
  '55%': {
    opacity: 1,
    filter: 'blur(0)',
  },
  to: {
    opacity: 0,
    transform: 'translateY(-50%) scale(5.4)',
    filter: 'blur(9px)',
  },
})

const pulseKf = stylex.keyframes({
  '0%': { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.22)' },
  '50%': { boxShadow: '0 0 0 10px rgba(255, 255, 255, 0)' },
  '100%': { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.22)' },
})

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'

const s = stylex.create({
  video: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#05070c',
    transitionProperty: 'opacity, filter',
    transitionDuration: '760ms, 520ms',
    transitionTimingFunction: `${EASE_OUT}, ${EASE_OUT}`,
  },
  videoGone: {
    opacity: 0,
    pointerEvents: 'none',
  },
  videoFilter: (filter: string) => ({ filter }),
  title: {
    position: 'fixed',
    left: 0,
    right: 0,
    top: '50%',
    zIndex: 41,
    transform: 'translateY(-50%)',
    textAlign: 'center',
    pointerEvents: 'none',
    opacity: 0,
    transformOrigin: '50% 50%',
    willChange: 'transform, opacity, filter',
  },
  titleTop: (top: string) => ({ top }),
  titleIn: {
    animationName: settleKf,
    animationDuration: '820ms',
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'forwards',
  },
  titleThrough: {
    animationName: throughKf,
    animationDuration: '1500ms',
    animationTimingFunction: 'cubic-bezier(0.55, 0, 0.85, 0.35)',
    animationFillMode: 'forwards',
  },
  mark: {
    margin: 0,
  },
  markImg: {
    display: 'block',
    width: '70%',
    height: 'auto',
    marginBlock: 0,
    marginInline: 'auto',
    WebkitMaskImage: 'radial-gradient(ellipse 60% 100% at 50% 50%, #000 38%, rgba(0, 0, 0, 0) 78%)',
    maskImage: 'radial-gradient(ellipse 60% 100% at 50% 50%, #000 38%, rgba(0, 0, 0, 0) 78%)',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: '400% 400%',
  },
  markWidth: (width: string) => ({ width }),
  markForm: {
    animationName: markFormKf,
    animationDuration: '1150ms',
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'forwards',
  },
  tag: {
    marginTop: '1.4em',
    marginBottom: 0,
    marginInline: 0,
    color: '#ffffff',
    fontSize: 'clamp(0.72rem, 1.55vw, 1.6rem)',
    fontWeight: 500,
    letterSpacing: '0.005em',
    textShadow: '0 0.08em 0.5em rgba(0, 0, 0, 0.8)',
  },
  prompt: {
    position: 'fixed',
    left: '50%',
    bottom: '12%',
    zIndex: 43,
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingBlock: '0.7rem',
    paddingInline: '1.3rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: '999px',
    backgroundColor: 'rgba(8, 12, 20, 0.55)',
    backdropFilter: 'blur(8px)',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    letterSpacing: '0.02em',
    cursor: 'pointer',
    animationName: pulseKf,
    animationDuration: '2.6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    transitionProperty: 'opacity',
    transitionDuration: '420ms',
    transitionTimingFunction: EASE_OUT,
  },
  controls: {
    position: 'fixed',
    right: 'max(1rem, env(safe-area-inset-right))',
    bottom: 'max(1rem, env(safe-area-inset-bottom))',
    zIndex: 42,
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    transitionProperty: 'opacity',
    transitionDuration: '320ms',
    transitionTimingFunction: EASE_OUT,
  },
  btn: {
    paddingBlock: '0.5rem',
    paddingInline: '0.95rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'rgba(255, 255, 255, 0.28)',
      ':hover': 'rgba(255, 255, 255, 0.55)',
    },
    borderRadius: '999px',
    backgroundColor: 'rgba(8, 12, 20, 0.4)',
    backdropFilter: 'blur(6px)',
    color: {
      default: 'rgba(255, 255, 255, 0.8)',
      ':hover': '#fff',
    },
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transitionProperty: 'opacity, border-color, color',
    transitionDuration: '320ms, 320ms, 320ms',
    transitionTimingFunction: `${EASE_OUT}, ${EASE_OUT}, ${EASE_OUT}`,
  },
  btnIcon: {
    paddingBlock: '0.5rem',
    paddingInline: '0.7rem',
    fontSize: '0.9rem',
    lineHeight: 1,
  },
  gone: {
    opacity: 0,
    pointerEvents: 'none',
    animationName: 'none',
  },
  visuallyHidden: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: 0,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
})

export function Intro({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const soundRef = useRef<HTMLButtonElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  const [frame, setFrame] = useState<{ mark: number; centre: number } | null>(null)
  const [exitFilter, setExitFilter] = useState<string | null>(null)
  const [videoGone, setVideoGone] = useState(false)
  const [controlsGone, setControlsGone] = useState(false)
  const [promptGone, setPromptGone] = useState(true)
  const [titlePhase, setTitlePhase] = useState<'idle' | 'in' | 'through'>('idle')
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    const sound = soundRef.current
    const skip = skipRef.current
    if (!video || !sound || !skip) return

    let arrived = false
    let titleShown = false
    let titleThrough = false
    const timers: number[] = []
    const undo: (() => void)[] = []
    const listen = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts)
      undo.push(() => target.removeEventListener(type, fn, opts))
    }

    const fitTitle = () => {
      const ratio = video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 16 / 9
      const w = window.innerWidth
      const h = window.innerHeight
      const frameW = coverFrameWidth(ratio, w, h)
      const frameH = coverFrameHeight(ratio, w, h)
      const frameTop = (h - frameH) / 2
      setFrame({ mark: MARK_WIDTH * Math.min(frameW, w), centre: frameTop + frameH * BLOCK_CENTRE })
    }

    const arrive = () => {
      if (arrived) return
      arrived = true
      markSeen()
      setExitFilter(`brightness(${exitBrightness(pageLuma())})`)
      setControlsGone(true)
      setPromptGone(true)
      requestAnimationFrame(() => setVideoGone(true))
      timers.push(
        window.setTimeout(() => {
          video.pause()
          doneRef.current()
        }, EXIT_MS),
      )
    }

    const skipIntro = () => {
      if (arrived || !Number.isFinite(video.duration)) {
        arrive()
        return
      }
      const tail = video.duration * ARRIVE
      if (video.currentTime < tail) video.currentTime = tail
    }

    const syncSoundControl = () => {
      setMuted(video.muted)
    }

    const unmuteOnFirstGesture = () => {
      const events = ['pointerdown', 'touchstart'] as const
      const onGesture = (event: Event): void => {
        const target = event.target
        if (target instanceof Node && sound.contains(target)) return

        for (const type of events) window.removeEventListener(type, onGesture)
        if (arrived) return

        video.muted = false
        if (video.currentTime > 0.2 && video.currentTime < video.duration * TITLE_THROUGH) {
          video.currentTime = 0
          titleShown = false
          titleThrough = false
          setTitlePhase('idle')
        }
        setPromptGone(true)
        syncSoundControl()
        video.pause()
        void video.play().catch(() => undefined)
      }
      for (const type of events) {
        listen(window, type, onGesture, { passive: true })
      }
      setPromptGone(false)
    }

    listen(sound, 'click', () => {
      const turningOn = video.muted
      video.muted = !video.muted
      syncSoundControl()
      if (turningOn) {
        video.pause()
        void video.play().catch(() => undefined)
      }
    })

    listen(skip, 'click', skipIntro)
    listen(window, 'keydown', (event) => {
      const key = (event as KeyboardEvent).key
      if (key === 'Escape' || key === 'Enter' || key === ' ') {
        event.preventDefault()
        skipIntro()
      }
    })

    listen(video, 'timeupdate', () => {
      const total = video.duration
      if (!Number.isFinite(total) || total <= 0) return
      const p = video.currentTime / total
      if (!titleShown && p >= TITLE_IN) {
        titleShown = true
        setTitlePhase('in')
      }
      if (!titleThrough && p >= TITLE_THROUGH) {
        titleThrough = true
        setTitlePhase('through')
      }
      if (p >= ARRIVE) arrive()
    })

    listen(video, 'error', arrive)
    listen(video, 'ended', arrive)

    listen(window, 'resize', fitTitle)
    listen(video, 'loadedmetadata', fitTitle)
    if ('fonts' in document) void document.fonts.ready.then(fitTitle)
    fitTitle()

    video.src = INTRO_SRC

    const start = () => {
      video.muted = false
      syncSoundControl()
      video
        .play()
        .then(syncSoundControl)
        .catch((error: unknown) => {
          const name = error instanceof Error ? error.name : 'unknown'
          console.warn(`[intro] sound autoplay refused (${name}); falling back to muted`, error)
          video.muted = true
          syncSoundControl()
          unmuteOnFirstGesture()
          void video.play().catch(arrive)
        })
    }

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      start()
    } else {
      const budget = window.setTimeout(arrive, BUFFER_BUDGET_MS)
      timers.push(budget)
      listen(
        video,
        'canplay',
        () => {
          window.clearTimeout(budget)
          start()
        },
        { once: true },
      )
    }

    return () => {
      for (const fn of undo) fn()
      for (const tm of timers) window.clearTimeout(tm)
      video.pause()
    }
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        {...stylex.props(s.video, exitFilter !== null && s.videoFilter(exitFilter), videoGone && s.videoGone)}
        playsInline
        muted
        preload="auto"
        poster="/intro/poster.jpg"
      />
      <div
        {...stylex.props(
          s.title,
          frame !== null && s.titleTop(`${frame.centre}px`),
          titlePhase === 'in' && s.titleIn,
          titlePhase === 'through' && s.titleThrough,
        )}
      >
        <div {...stylex.props(s.mark)}>
          <img
            {...stylex.props(s.markImg, frame !== null && s.markWidth(`${frame.mark}px`), titlePhase === 'in' && s.markForm)}
            src="/intro/wordmark.webp"
            alt="Unstoppable Math"
          />
        </div>
        <p {...stylex.props(s.tag)} aria-hidden="true">
          Mastering math is a solved problem.
        </p>
      </div>
      <button
        {...stylex.props(s.prompt, promptGone && s.gone)}
        type="button"
        data-cuelume-press="tick"
      >
        <span aria-hidden="true">{'\u{1F50A}'}</span> Tap for sound
      </button>
      <div {...stylex.props(s.controls, controlsGone && s.gone)}>
        <button
          ref={soundRef}
          {...stylex.props(s.btn, s.btnIcon)}
          type="button"
          aria-pressed={!muted}
          title="Sound"
          data-cuelume-press="tick"
        >
          <span aria-hidden="true">{muted ? '\u{1F507}' : '\u{1F50A}'}</span>
          <span {...stylex.props(s.visuallyHidden)}>{muted ? 'Turn sound on' : 'Turn sound off'}</span>
        </button>
        <button ref={skipRef} {...stylex.props(s.btn)} type="button" data-cuelume-press="tick">
          Skip
        </button>
      </div>
    </>
  )
}
