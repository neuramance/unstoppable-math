import * as stylex from '@stylexjs/stylex'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import type { Lesson } from '@/lib/lesson'
import { chrome } from './chrome'
import { Session } from './session'

const PlayableLesson = z.object({ items: z.array(z.object({ mode: z.enum(['typed', 'frac', 'shade']) })) })
const STALE = 'stale lesson data'

type LessonLoad =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; lesson: Lesson }
  | { phase: 'failed'; why: 'network' | 'stale' }

function LessonGate({ load, onRetry }: { load: Exclude<LessonLoad, { phase: 'ready' }>; onRetry: () => void }) {
  return (
    <section {...stylex.props(chrome.pintro)}>
      <p {...stylex.props(chrome.eyebrow, chrome.rise)}>Learn · fractions · Boulton atomisation</p>
      {load.phase !== 'failed' ? (
        <p {...stylex.props(chrome.lede, chrome.rise)}>Loading the lesson.</p>
      ) : load.why === 'stale' ? (
        <>
          <p {...stylex.props(chrome.lede, chrome.rise)}>
            {
              "You've caught a lesson file that doesn't match this build of the player, so none of it would read the way it was written. Reload to pick up the current version."
            }
          </p>
          <button
            {...stylex.props(chrome.btn, chrome.ghost, chrome.rise)}
            onClick={() => location.reload()}
            data-cuelume-press="press"
          >
            Reload
          </button>
        </>
      ) : (
        <>
          <p {...stylex.props(chrome.lede, chrome.rise)}>
            {"The lesson didn't load. Check your connection, then try again."}
          </p>
          <button {...stylex.props(chrome.btn, chrome.ghost, chrome.rise)} onClick={onRetry} data-cuelume-press="press">
            Try again
          </button>
        </>
      )}
    </section>
  )
}

export function Learn({ dev, onExit }: { dev: boolean; onExit: () => void }) {
  const [load, setLoad] = useState<LessonLoad>({ phase: 'idle' })
  const asked = useRef(false)
  const phase = load.phase
  useEffect(() => {
    if (phase !== 'idle' || asked.current) return
    asked.current = true
    setLoad({ phase: 'loading' })
    fetch('/lessons/NF_Fractions.lesson.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((l: Lesson) => {
        if (!PlayableLesson.safeParse(l).success) throw new Error(STALE)
        setLoad({ phase: 'ready', lesson: l })
      })
      .catch((e: unknown) => {
        setLoad({ phase: 'failed', why: e instanceof Error && e.message === STALE ? 'stale' : 'network' })
      })
  }, [phase])
  const retry = () => {
    asked.current = false
    setLoad({ phase: 'idle' })
  }
  if (load.phase === 'ready') return <Session lesson={load.lesson} dev={dev} onExit={onExit} />
  return <LessonGate load={load} onRetry={retry} />
}
