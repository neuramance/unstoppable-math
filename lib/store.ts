import { supabase } from './supabase-client'

const SYNCED_PREFIXES = ['um.placement.', 'um.session.', 'um.lesson.', 'um.profile:']

export function synced(key: string): boolean {
  return SYNCED_PREFIXES.some((p) => key.startsWith(p))
}

const UID_CACHE = 'um.uid'

let uid = 'local'

export function activeId(): string {
  return uid
}

export function mergePlan(
  localKeys: string[],
  rows: { key: string; value: string }[],
): { toLocal: { key: string; value: string }[]; toServer: string[] } {
  const server = new Set(rows.map((r) => r.key))
  return {
    toLocal: rows,
    toServer: localKeys.filter((k) => synced(k) && !server.has(k)),
  }
}

function localKeys(): string[] {
  try {
    return Object.keys(localStorage)
  } catch {
    return []
  }
}

function push(key: string, value: string): void {
  void supabase()
    .from('app_state')
    .upsert({ user_id: uid, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' })
    .then(({ error }) => {
      if (error) console.warn(`[store] sync write failed for ${key}: ${error.message}`)
    })
}

let opening: Promise<void> | undefined

export function openStore(): Promise<void> {
  return (opening ??= open())
}

async function open(): Promise<void> {
  let id: string | null
  try {
    const { data } = await supabase().auth.getSession()
    id = data.session?.user.id ?? null
    if (id === null) {
      const { data: fresh, error } = await supabase().auth.signInAnonymously()
      if (error) throw error
      id = fresh.user?.id ?? null
    }
  } catch {
    id = null
  }
  if (id === null) {
    try {
      uid = localStorage.getItem(UID_CACHE) ?? 'local'
    } catch {
      uid = 'local'
    }
    return
  }
  uid = id
  try {
    localStorage.setItem(UID_CACHE, id)
  } catch {}
  try {
    const { data, error } = await supabase().from('app_state').select('key,value')
    if (error) throw error
    const rows = (data ?? []).flatMap((r) => {
      const value = typeof r.value === 'string' ? r.value : r.value === null ? null : JSON.stringify(r.value)
      return value === null ? [] : [{ key: r.key, value }]
    })
    const plan = mergePlan(localKeys(), rows)
    for (const r of plan.toLocal) localStorage.setItem(r.key, r.value)
    for (const key of plan.toServer) {
      const value = localStorage.getItem(key)
      if (value !== null) push(key, value)
    }
  } catch {}
}

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {}
  if (synced(key) && uid !== 'local') push(key, value)
}

export async function removeItem(key: string): Promise<void> {
  try {
    localStorage.removeItem(key)
  } catch {}
  if (synced(key) && uid !== 'local') {
    try {
      const { error } = await supabase().from('app_state').delete().eq('user_id', uid).eq('key', key)
      if (error) console.warn(`[store] sync delete failed for ${key}: ${error.message}`)
    } catch {}
  }
}
