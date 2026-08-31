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

type IntroUi = {
  onDone: () => void
  setFrame: (f: { mark: number; centre: number } | null) => void
  setExitFilter: (f: string) => void
  setVideoGone: (v: boolean) => void
  setControlsGone: (v: boolean) => void
  setPromptGone: (v: boolean) => void
  setTitlePhase: (p: 'idle' | 'in' | 'through') => void
  setMuted: (m: boolean) => void
}

function fitTitle(video: HTMLVideoElement, setFrame: IntroUi['setFrame']) {
  const ratio = video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 16 / 9
  const w = window.innerWidth
  const h = window.innerHeight
  const frameW = coverFrameWidth(ratio, w, h)
  const frameH = coverFrameHeight(ratio, w, h)
  const frameTop = (h - frameH) / 2
  setFrame({ mark: MARK_WIDTH * Math.min(frameW, w), centre: frameTop + frameH * BLOCK_CENTRE })
}

function wireIntro(video: HTMLVideoElement, sound: HTMLButtonElement, skip: HTMLButtonElement, ui: IntroUi) {
  const { setFrame, setExitFilter, setVideoGone, setControlsGone, setPromptGone, setTitlePhase, setMuted } = ui
  const doneRef = { current: ui.onDone }
  let arrived = false
  let titleShown = false
  let titleThrough = false
  const timers: number[] = []
  const undo: (() => void)[] = []
  const listen = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts)
    undo.push(() => target.removeEventListener(type, fn, opts))
  }

  const fit = () => fitTitle(video, setFrame)

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
    markSeen()
    if (arrived || !Number.isFinite(video.duration)) return arrive()
    const tail = video.duration * ARRIVE
    if (video.currentTime < tail) video.currentTime = tail
  }

  const syncSoundControl = () => setMuted(video.muted)

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

  listen(window, 'resize', fit)
  listen(video, 'loadedmetadata', fit)
  if ('fonts' in document) void document.fonts.ready.then(fit)
  fit()

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
}

export function useIntro(onDone: () => void) {
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
    return wireIntro(video, sound, skip, {
      onDone: () => doneRef.current(),
      setFrame,
      setExitFilter,
      setVideoGone,
      setControlsGone,
      setPromptGone,
      setTitlePhase,
      setMuted,
    })
  }, [])

  return { videoRef, soundRef, skipRef, frame, exitFilter, videoGone, controlsGone, promptGone, titlePhase, muted }
}
