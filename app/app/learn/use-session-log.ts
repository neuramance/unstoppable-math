/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { activeId, readItem, removeItem, writeItem } from '@/lib/store'
import { z } from 'zod'

const store = (topic: string) => `um.session.${topic}:${activeId()}`

const StoredLog = z.array(
  z.union([
    z.object({
      kind: z.literal('start'),
      plan: z.object({ startedAt: z.number(), blocks: z.array(z.object({ rows: z.array(z.object({})) })) }),
    }),
    z.object({ kind: z.literal('trial'), typed: z.string(), at: z.number() }),
  ]),
)

export function readLog(text: string): SessionLog | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return StoredLog.safeParse(parsed).success ? (parsed as SessionLog) : null
  } catch {
    return null
  }
}

function loadLog(key: string): { log: SessionLog | null; unreadable: boolean; volatile: boolean } {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return { log: null, unreadable: false, volatile: true }
  }
  if (!raw) return { log: null, unreadable: false, volatile: false }
  const log = readLog(raw)
  return { log, unreadable: log === null, volatile: false }
}

const NO_HISTORY: RowHistory = new Map()

function saveLog(key: string, log: SessionLog | null): boolean {
  if (log === null) {
    removeItem(key)
    return true
  }
  return writeItem(key, JSON.stringify(log))
}

function parkLog(key: string) {
  const raw = readItem(key)
  if (raw !== null) writeItem(`${key}.unreadable`, raw)
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
  const logRef = useRef(stored.log)
  const [wiped, setWiped] = useState(false)
  const [volatile, setVolatile] = useState(stored.volatile)

  const commit = useCallback(
    (next: SessionLog | null) => {
      logRef.current = next
      if (!saveLog(key, next)) setVolatile(true)
      setLog(next)
    },
    [key],
  )

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
    commit(null)
    setWiped(true)
  }, [broken, commit, key])

  const [previewedAt] = useState(() => Date.now())
  const preview = useMemo(() => planSession(lesson, history ?? NO_HISTORY, previewedAt), [lesson, history, previewedAt])

  const begin = () => {
    const fresh = planSession(lesson, history ?? NO_HISTORY, Date.now())
    commit([...(logRef.current ?? []), { kind: 'start', plan: fresh }])
  }

  const append = (entry: TrialEntry) => {
    commit([...(logRef.current ?? []), { kind: 'trial', typed: entry.typed, at: Date.now() }])
  }

  const jump = (row: number | null, now: number, kind: 'instruction' | 'testing' = 'instruction', item = 0) => {
    const { plan: fresh, trials, priors } = jumpToRow(lesson, row, now, kind, item)
    commit([
      ...(logRef.current ?? []),
      ...priors,
      { kind: 'start', plan: fresh },
      ...trials.map((tr): SessionLog[number] => ({ kind: 'trial', ...tr })),
    ])
  }

  const reset = () => {
    commit(null)
    setWiped(false)
  }

  return { session, live, history, audit, wiped, volatile, preview, begin, append, jump, reset }
}
