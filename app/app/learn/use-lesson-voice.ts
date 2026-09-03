/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { badgeCount } from '@/lib/figures'
import { CARDINALS, clipKey, narrated, replayLesson } from '@/lib/lesson'
import type { Lesson, LessonItem, TrialEntry } from '@/lib/lesson'
import { readItem, writeItem } from '@/lib/store'
import { reduced } from './ui'

export function scheduleCount(
  n: number,
  words: readonly (readonly [string, number])[],
  endMs: number,
): [number, number][] {
  const pending = Array.from({ length: n }, (_, i) => i + 1)
  const anchored = new Map<number, number>()
  let at = 0
  for (const k of pending) {
    const want = CARDINALS[k]
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

export function initialShown(item: LessonItem | null): number | null {
  return item && item.role === 'model' && item.figures?.length === 1 && item.count !== undefined ? 0 : null
}

export function useLessonVoice(
  lesson: Lesson,
  log: TrialEntry[],
  item: LessonItem | null,
  feedback: boolean,
  model: boolean,
  auto: boolean,
  muted: boolean,
) {
  const [voiced, setVoiced] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [ccOn, setCcOn] = useState(() => readItem(CC_KEY) === '1')
  const [shown, setShown] = useState<number | null>(() => {
    const st = replayLesson(lesson, log).current
    return initialShown(st ? lesson.items[st.item] : null)
  })
  const audRef = useRef<HTMLAudioElement | null>(null)
  const voiceOkRef = useRef(true)
  const mutedRef = useRef(muted)

  useEffect(() => {
    mutedRef.current = muted
    const aud = audRef.current
    if (aud !== null) aud.muted = muted
  }, [muted])

  const bless = () => {
    const aud = audRef.current
    if (aud === null || voiceOkRef.current || aud.src === '') return
    aud.muted = true
    void aud
      .play()
      .then(() => aud.pause())
      .catch(() => undefined)
      .finally(() => {
        aud.muted = mutedRef.current
      })
  }

  const setCc = (on: boolean) => {
    setCcOn(on)
    writeItem(CC_KEY, on ? '1' : '0')
  }

  useEffect(() => {
    if (!item || auto || reduced()) {
      setVoiced(false)
      setPlaying(false)
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
      if (text === undefined) {
        setPlaying(false)
        return
      }
      const finale = at === texts.length - 1
      setPlaying(true)
      aud.src = `/audio/lesson/${clipKey(narrated(text))}.mp3`
      aud.muted = mutedRef.current
      aud.onended = () => {
        at += 1
        speak()
      }
      aud.play().then(
        () => {
          if (dead) return
          voiceOkRef.current = true
          setVoiced(true)
          if (counts && finale) {
            void alignmentIndex().then((index) => {
              if (dead) return
              const entry = index[clipKey(narrated(text))]
              const endMs =
                entry?.end ?? (Number.isFinite(aud.duration) && aud.duration > 0 ? aud.duration * 1000 : total * 600)
              for (const [k, delay] of scheduleCount(total, entry?.words ?? [], endMs))
                timers.push(setTimeout(() => setShown(k), delay))
            })
          }
        },
        () => {
          if (dead) return
          voiceOkRef.current = false
          setVoiced(false)
          setPlaying(false)
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

  return { voiced, audible: playing && !muted, ccOn, setCc, shown, setShown, bless }
}
