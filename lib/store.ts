import { supabase } from './supabase-client'

const SYNCED_PREFIXES = ['um.placement.', 'um.session.', 'um.lesson.', 'um.profile:']
const UID_CACHE = 'um.uid'
const UNSYNCED = 'um.unsynced'

export function synced(key: string): boolean {
  return SYNCED_PREFIXES.some((p) => key.startsWith(p))
}

type Client = ReturnType<typeof supabase>
type Row = { key: string; value: string }
type Change = { key: string; value: string | null }

let uid = 'local'
let client: Client | null = null
const unsynced = new Set<string>()
const pending = new Map<string, string | null>()
let draining: Promise<void> | null = null

export function activeId(): string {
  return uid
}

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function localEntries(): Map<string, string> {
  try {
    return new Map(Object.entries(localStorage))
  } catch {
    return new Map()
  }
}

function storedUnsynced(): string[] {
  try {
    const parsed: unknown = JSON.parse(readItem(UNSYNCED) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

function markUnsynced(key: string, on: boolean): void {
  if (on) unsynced.add(key)
  else unsynced.delete(key)
  const disk = new Set(storedUnsynced())
  if (on) disk.add(key)
  else disk.delete(key)
  try {
    localStorage.setItem(UNSYNCED, JSON.stringify([...disk]))
  } catch {}
}

const isLog = (key: string) => key.startsWith('um.session.') && !key.endsWith('.unreadable')

function mergedLogs(remote: string, mine: string): string {
  let a: unknown
  let b: unknown
  try {
    a = JSON.parse(remote)
    b = JSON.parse(mine)
  } catch {
    return mine
  }
  if (!Array.isArray(a) || !Array.isArray(b)) return mine
  const prefix = (p: unknown[], q: unknown[]) =>
    p.length <= q.length && p.every((e, i) => JSON.stringify(e) === JSON.stringify(q[i]))
  if (prefix(a, b)) return mine
  if (prefix(b, a)) return remote
  return JSON.stringify([...a, ...b])
}

export function mergePlan(
  local: ReadonlyMap<string, string>,
  unconfirmed: ReadonlySet<string>,
  rows: Row[],
): { toLocal: Row[]; toServer: Change[] } {
  const server = new Map(rows.map((r) => [r.key, r.value]))
  const toLocal = rows.filter((r) => !unconfirmed.has(r.key))
  const toServer: Change[] = []
  for (const key of new Set([...local.keys(), ...unconfirmed].filter(synced))) {
    const remote = server.get(key)
    if (remote !== undefined && !unconfirmed.has(key)) continue
    const mine = local.get(key) ?? null
    const value = remote !== undefined && mine !== null && isLog(key) ? mergedLogs(remote, mine) : mine
    if (value !== null && value !== mine) toLocal.push({ key, value })
    toServer.push({ key, value })
  }
  return { toLocal, toServer }
}

async function drain(sb: Client): Promise<void> {
  try {
    for (const [key, value] of pending) {
      pending.delete(key)
      const table = sb.from('app_state')
      const { error } =
        value === null
          ? await table.delete().eq('user_id', uid).eq('key', key)
          : await table.upsert(
              { user_id: uid, key, value, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,key' },
            )
      if (error) {
        console.warn(`[store] sync ${value === null ? 'delete' : 'write'} failed for ${key}: ${error.message}`)
        continue
      }
      if (!pending.has(key)) markUnsynced(key, false)
    }
  } finally {
    draining = null
  }
}

function push(key: string, value: string | null): void {
  if (!synced(key)) return
  markUnsynced(key, true)
  if (client === null) return
  pending.set(key, value)
  draining ??= drain(client)
}

export function flushed(): Promise<void> {
  return draining ?? Promise.resolve()
}

async function signedIn(sb: Client): Promise<string> {
  const { data } = await sb.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: fresh, error } = await sb.auth.signInAnonymously()
  if (error) throw error
  if (fresh.user === null) throw new Error('anonymous sign-in returned no user')
  return fresh.user.id
}

function rekey(from: string, to: string): void {
  for (const [key, value] of localEntries()) {
    if (!key.includes(`:${from}`)) continue
    const moved = key.replace(`:${from}`, `:${to}`)
    try {
      localStorage.removeItem(key)
      localStorage.setItem(moved, value)
    } catch {}
    markUnsynced(key, false)
    markUnsynced(moved, true)
  }
}

let opening: Promise<void> | undefined

export function openStore(): Promise<void> {
  return (opening ??= open())
}

async function open(): Promise<void> {
  for (const key of storedUnsynced()) unsynced.add(key)
  const cached = readItem(UID_CACHE) ?? 'local'
  uid = cached
  let sb: Client
  let id: string
  try {
    sb = supabase()
    id = await signedIn(sb)
  } catch {
    return
  }
  if (cached !== id) rekey(cached, id)
  uid = id
  try {
    localStorage.setItem(UID_CACHE, id)
  } catch {}
  const { data, error } = await sb.from('app_state').select('key,value')
  if (error) {
    console.warn(`[store] sync read failed: ${error.message}`)
    client = sb
    return
  }
  const rows = (data ?? []).flatMap((r) => {
    const value = typeof r.value === 'string' ? r.value : r.value === null ? null : JSON.stringify(r.value)
    return value === null ? [] : [{ key: r.key, value }]
  })
  const plan = mergePlan(localEntries(), unsynced, rows)
  try {
    for (const r of plan.toLocal) localStorage.setItem(r.key, r.value)
  } catch {}
  client = sb
  for (const change of plan.toServer) push(change.key, change.value)
}

export function writeItem(key: string, value: string): boolean {
  let stored = true
  try {
    localStorage.setItem(key, value)
  } catch {
    stored = false
  }
  push(key, value)
  return stored
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {}
  push(key, null)
}
