/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react'
import type { Lesson, TrialEntry } from '@/lib/lesson'
import {
  jumpToRow,
  planSession,
  replayLog,
  replaySession,
  type LogAudit,
  type RowHistory,
  type SessionLog,
  type SessionPlan,
  type SessionState,
  type Trial,
} from '@/lib/session'
import { activeId, removeItem, writeItem } from '@/lib/store'

const store = (topic: string) => `um.session.${topic}:${activeId()}`

function loadLog(key: string): { log: SessionLog | null; unreadable: boolean } {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return { log: null, unreadable: false }
  }
  if (!raw) return { log: null, unreadable: false }
  try {
    return { log: JSON.parse(raw) as SessionLog, unreadable: false }
  } catch {
    return { log: null, unreadable: true }
  }
}

const NO_HISTORY: RowHistory = new Map()

function saveLog(key: string, log: SessionLog | null) {
  if (log === null) void removeItem(key)
  else writeItem(key, JSON.stringify(log))
}

function parkLog(key: string) {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) writeItem(`${key}.unreadable`, raw)
  } catch {
    return
  }
}

function emptyAudit(): LogAudit {
  return {
    history: new Map(),
    staleRows: [],
    droppedRows: [],
    lostRows: [],
    droppedTrials: 0,
    unreadableSessions: 0,
    unstamped: false,
  }
}

export function useSessionLog(lesson: Lesson) {
  const [key] = useState(() => store(lesson.topic))
  const [stored] = useState(() => loadLog(key))
  const [log, setLog] = useState<SessionLog | null>(stored.log)
  const [wiped, setWiped] = useState(false)

  const audit: LogAudit | null = useMemo(() => {
    if (log === null) return emptyAudit()
    try {
      return replayLog(lesson, log)
    } catch {
      return null
    }
  }, [lesson, log])
  const history = audit?.history ?? null

  const live = useMemo(() => {
    if (!log) return null
    let idx = -1
    for (let i = log.length - 1; i >= 0; i--)
      if (log[i].kind === 'start') {
        idx = i
        break
      }
    if (idx < 0) return null
    const start = log[idx] as { kind: 'start'; plan: SessionPlan }
    const trials: Trial[] = []
    for (const ev of log.slice(idx + 1)) if (ev.kind === 'trial') trials.push({ typed: ev.typed, at: ev.at })
    return { plan: start.plan, starts: log.filter((e) => e.kind === 'start').length, trials }
  }, [log])

  const session = useMemo((): SessionState | null => {
    if (!live) return null
    try {
      const st = replaySession(lesson, live.plan, live.trials)
      return st.staleAt === null ? st : null
    } catch {
      return null
    }
  }, [lesson, live])

  const broken = stored.unreadable || (log !== null && audit === null)
  useEffect(() => {
    if (!broken) return
    parkLog(key)
    saveLog(key, null)
    setLog(null)
    setWiped(true)
  }, [broken, key])

  const [previewedAt] = useState(() => Date.now())
  const preview = useMemo(() => planSession(lesson, history ?? NO_HISTORY, previewedAt), [lesson, history, previewedAt])

  const commit = (next: SessionLog) => {
    saveLog(key, next)
    setLog(next)
  }

  const begin = () => {
    const fresh = planSession(lesson, history ?? NO_HISTORY, Date.now())
    commit([...(log ?? []), { kind: 'start', plan: fresh }])
  }

  const append = (entry: TrialEntry) => {
    commit([...(log ?? []), { kind: 'trial', typed: entry.typed, at: Date.now() }])
  }

  const jump = (row: number | null, now: number, kind: 'instruction' | 'testing' = 'instruction', item = 0) => {
    const { plan: fresh, trials, priors } = jumpToRow(lesson, row, now, kind, item)
    commit([
      ...(log ?? []),
      ...priors,
      { kind: 'start', plan: fresh },
      ...trials.map((tr): SessionLog[number] => ({ kind: 'trial', ...tr })),
    ])
  }

  const reset = () => {
    saveLog(key, null)
    setLog(null)
    setWiped(false)
  }

  return { session, live, history, audit, wiped, preview, begin, append, jump, reset }
}
