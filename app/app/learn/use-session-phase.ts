/* eslint-disable react-hooks/set-state-in-effect */

import { play } from 'cuelume'
import { useEffect, useState } from 'react'
import type { SessionState } from '@/lib/session'
import { reduced } from './ui'

export type Phase = 'idle' | 'dropping' | 'active' | 'crack' | 'shatter' | 'done'

export function useSessionPhase(session: SessionState | null) {
  const playing = session !== null && !session.done
  const [ui, setUi] = useState<{ phase: Phase; shown: number; mode?: 'drop' | 'step' } | null>(null)

  useEffect(() => {
    if (ui === null && playing && session) setUi({ phase: 'active', shown: session.blockIndex, mode: 'step' })
  }, [ui, playing, session])

  useEffect(() => {
    if (session === null && ui !== null) setUi(null)
  }, [session, ui])

  const phase = ui?.phase ?? (playing ? 'active' : 'idle')
  const shown = ui?.shown ?? (playing && session ? session.blockIndex : 0)

  useEffect(() => {
    if (phase !== 'dropping') return
    const timer = setTimeout(() => setUi({ phase: 'active', shown: 0, mode: 'drop' }), 1300)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'active' || !session) return
    if (!session.done && session.blockIndex === shown) return
    if (reduced()) {
      if (session.done) {
        play('ready')
        setUi({ phase: 'done', shown })
      } else setUi({ phase: 'active', shown: session.blockIndex, mode: 'step' })
      return
    }
    setUi({ phase: 'crack', shown })
  }, [phase, session, shown])

  useEffect(() => {
    if (phase !== 'crack') return
    const timer = setTimeout(() => setUi({ phase: 'shatter', shown }), 160)
    return () => clearTimeout(timer)
  }, [phase, shown])

  useEffect(() => {
    if (phase !== 'shatter' || !session) return
    const timer = setTimeout(() => {
      if (session.done) {
        play('ready')
        setUi({ phase: 'done', shown })
      } else setUi({ phase: 'active', shown: session.blockIndex, mode: 'step' })
    }, 660)
    return () => clearTimeout(timer)
  }, [phase, session, shown])

  const start = () => setUi({ phase: reduced() ? 'active' : 'dropping', shown: 0, mode: 'drop' })
  const clear = () => setUi(null)
  const entrance = ui?.mode ?? 'step'

  return { phase, shown, entrance, playing, start, clear }
}
