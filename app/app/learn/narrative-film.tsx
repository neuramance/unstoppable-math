import * as stylex from '@stylexjs/stylex'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '@/app/tokens.stylex'
import { cueAt, parseNarrativeCues, type NarrativeCue } from '@/lib/narrative'
import { reduced } from './ui'

const FILM_REGISTER = {
  play: 'Tap to start the story',
  skip: 'Skip',
}

const s = stylex.create({
  stage: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    backgroundColor: '#0b0b0c',
    '--film-h': 'min(100vh, 75vw)',
    '--film-w': 'min(100vw, 133.3333vh)',
  },
  film: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  cap: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc((100vh - var(--film-h)) / 2 + var(--film-h) * 0.0667)',
    width: 'calc(var(--film-w) * 0.7292)',
    margin: 0,
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 'max(15px, calc(var(--film-h) * 0.0389))',
    lineHeight: 1.24,
    letterSpacing: '-0.005em',
    color: '#fcfcfc',
    WebkitTextStrokeWidth: 'max(2px, calc(var(--film-h) * 0.00556))',
    WebkitTextStrokeColor: 'rgba(0, 0, 0, 0.62)',
    paintOrder: 'stroke fill',
    filter: 'drop-shadow(0 4px 18px rgba(0, 0, 0, 0.45))',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  capLine: {
    display: 'block',
  },
  skip: {
    position: 'absolute',
    right: 'max(1.25rem, env(safe-area-inset-right))',
    bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
    paddingBlock: '0.55rem',
    paddingInline: '1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: 'rgba(255, 255, 255, 0.28)', ':hover': 'rgba(255, 255, 255, 0.55)' },
    borderRadius: '999px',
    backgroundColor: 'rgba(8, 10, 14, 0.45)',
    backdropFilter: 'blur(6px)',
    color: { default: 'rgba(255, 255, 255, 0.82)', ':hover': '#fff' },
    fontFamily: 'inherit',
    fontStyle: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  playBtn: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    paddingBlock: '0.6rem',
    paddingInline: '1.1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 28%, transparent)`,
    borderRadius: '999px',
    backgroundColor: `color-mix(in srgb, ${t.void} 55%, transparent)`,
    backdropFilter: 'blur(6px)',
    color: t.ink,
    fontFamily: 'inherit',
    fontStyle: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    fontSize: '0.82rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
})

const EXIT_GRACE_MS = 900
const SETTLE_MS = 450

function cueUrl(file: string): string {
  return `/videos/${file.replace(/\.mp4$/, '')}.cues.json`
}

async function goFullscreen(stage: HTMLElement | null): Promise<void> {
  if (stage === null || document.fullscreenElement !== null) return
  try {
    await stage.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    return
  }
}

function nudgeLayout(): void {
  void document.body.offsetHeight
  window.dispatchEvent(new Event('resize'))
}

async function leaveFullscreen(stage: HTMLElement | null): Promise<void> {
  if (stage === null || document.fullscreenElement !== stage) return
  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      document.removeEventListener('fullscreenchange', done)
      resolve()
    }
    document.addEventListener('fullscreenchange', done)
    window.setTimeout(done, EXIT_GRACE_MS)
    document.exitFullscreen().catch(done)
  })

  await new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS))

  if (document.fullscreenElement !== null) {
    await document.exitFullscreen().catch(() => undefined)
    await new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS))
  }

  nudgeLayout()
}

export function NarrativeFilm({
  file,
  auto,
  dev,
  muted,
  onDone,
}: {
  file: string
  auto: boolean
  dev: boolean
  muted: boolean
  onDone: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const vidRef = useRef<HTMLVideoElement>(null)
  const [cues, setCues] = useState<readonly NarrativeCue[]>([])
  const [cue, setCue] = useState<NarrativeCue | null>(null)
  const [needsStart, setNeedsStart] = useState(reduced)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(cueUrl(file), { signal: controller.signal })
        if (!response.ok) throw new Error(`captions answered ${response.status}`)
        const parsed = parseNarrativeCues(await response.json())
        if (parsed.film !== file) throw new Error(`captions are for ${parsed.film}, not ${file}`)
        setCues(parsed.cues)
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn(`[narrative] no captions for ${file}`, error)
      }
    })()
    return () => controller.abort()
  }, [file])

  useEffect(() => {
    const video = vidRef.current
    if (video === null || cues.length === 0) return
    let shown = -1
    let frame = 0
    const tick = () => {
      const next = cueAt(cues, video.currentTime)
      if ((next?.index ?? -1) !== shown) {
        shown = next?.index ?? -1
        setCue(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [cues])

  useEffect(() => {
    const stage = stageRef.current
    if (reduced()) return () => void leaveFullscreen(stage)
    void goFullscreen(stage)
    void vidRef.current
      ?.play()
      .then(() => setNeedsStart(false))
      .catch(() => setNeedsStart(true))
    return () => void leaveFullscreen(stage)
  }, [])

  const mounted = useRef(true)
  const settled = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const finish = async () => {
    if (settled.current) return
    settled.current = true
    await leaveFullscreen(stageRef.current)
    if (mounted.current) doneRef.current()
  }

  useEffect(() => {
    if (!auto) return
    const t = setTimeout(() => void finish(), 130)
    return () => clearTimeout(t)
  })

  return createPortal(
    <div {...stylex.props(s.stage)} ref={stageRef}>
      <video
        ref={vidRef}
        {...stylex.props(s.film)}
        src={`/videos/${file}`}
        playsInline
        preload="auto"
        muted={muted}
        onEnded={() => void finish()}
        onError={() => void finish()}
      />
      {cue !== null && (
        <p {...stylex.props(s.cap)}>
          {cue.lines.map((line, i) => (
            <span key={i} {...stylex.props(s.capLine)}>
              {line}
            </span>
          ))}
        </p>
      )}
      {dev && (
        <button {...stylex.props(s.skip)} type="button" onClick={() => void finish()} data-cuelume-press="tick">
          {FILM_REGISTER.skip}
        </button>
      )}
      {needsStart && (
        <button
          {...stylex.props(s.playBtn)}
          type="button"
          onClick={() => {
            void goFullscreen(stageRef.current)
            void vidRef.current
              ?.play()
              .then(() => setNeedsStart(false))
              .catch(() => undefined)
          }}
          data-cuelume-press="tick"
        >
          {FILM_REGISTER.play}
        </button>
      )}
    </div>,
    document.body,
  )
}
