import { expect, test, vi } from 'vitest'
import { mergePlan, openStore, synced } from './store'
import type { supabase } from './supabase-client'

type Client = ReturnType<typeof supabase>
type Row = { key: string; value: string }
type Write = { user_id: string; key: string; value: string | null }
type FakeOpts = { select?: { data: Row[] | null; error: { message: string } | null }; hold?: Promise<void> }

function fakeClient(session: string | null, fresh: string, rows: Row[], opts: FakeOpts = {}) {
  const writes: Write[] = []
  const table = {
    select: async () => {
      await (opts.hold ?? Promise.resolve())
      return opts.select ?? { data: rows, error: null }
    },
    upsert: async ({ user_id, key, value }: Write) => {
      writes.push({ user_id, key, value })
      return { error: null }
    },
    delete: () => ({
      eq: (_column: string, user_id: string) => ({
        eq: async (_column2: string, key: string) => {
          writes.push({ user_id, key, value: null })
          return { error: null }
        },
      }),
    }),
  }
  const auth = {
    getSession: async () => {
      await (opts.hold ?? Promise.resolve())
      return { data: { session: session === null ? null : { user: { id: session } } } }
    },
    signInAnonymously: async () => ({ data: { user: { id: fresh } }, error: null }),
  }
  return { client: { auth, from: () => table } as unknown as Client, writes }
}

async function boot(factory: () => Client) {
  vi.resetModules()
  vi.doMock('./supabase-client', () => ({ supabase: factory }))
  const store = await import('./store')
  await store.openStore()
  return store
}

const settle = () => new Promise((resolve) => setTimeout(resolve))
const unsyncedKeys = () => JSON.parse(localStorage.getItem('um.unsynced') ?? '[]') as string[]

test('progress and the profile sync; device settings never do', () => {
  for (const key of [
    'um.placement.g4.v2:abc',
    'um.session.nf-fractions:abc',
    'um.lesson.nf-fractions.attempt:abc',
    'um.profile:abc',
    'um.session.nf-fractions:abc.unreadable',
  ]) {
    expect({ key, synced: synced(key) }).toEqual({ key, synced: true })
  }
  for (const key of ['um.theme', 'um.dev', 'um.uid', 'um.unsynced', 'um.intro-seen', 'unrelated']) {
    expect({ key, synced: synced(key) }).toEqual({ key, synced: false })
  }
})

test('at boot, unconfirmed local changes win, the server fills the rest, and keys the server lacks push up', () => {
  const rows = [
    { key: 'um.session.nf-fractions:u', value: '[1]' },
    { key: 'um.profile:u', value: '{"name":"A"}' },
    { key: 'um.lesson.nf-fractions.attempt:u', value: '1' },
  ]
  const local = new Map([
    ['um.session.nf-fractions:u', '[1,2]'],
    ['um.profile:u', '{"name":"B"}'],
    ['um.placement.g4.v2:u', 'x'],
    ['um.theme', 'dark'],
  ])
  const plan = mergePlan(local, new Set(['um.session.nf-fractions:u', 'um.lesson.nf-fractions.attempt:u']), rows)
  expect(plan.toLocal).toEqual([{ key: 'um.profile:u', value: '{"name":"A"}' }])
  expect(plan.toServer).toEqual([
    { key: 'um.session.nf-fractions:u', value: '[1,2]' },
    { key: 'um.placement.g4.v2:u', value: 'x' },
    { key: 'um.lesson.nf-fractions.attempt:u', value: null },
  ])
})

test('an empty side is legal on both ends', () => {
  expect(mergePlan(new Map(), new Set(), [])).toEqual({ toLocal: [], toServer: [] })
  const rows = [{ key: 'um.session.x:u', value: '[]' }]
  expect(mergePlan(new Map(), new Set(), rows)).toEqual({ toLocal: rows, toServer: [] })
})

test('opening the store twice is one open: StrictMode double-mounts must not race two sign-ins', () => {
  expect(openStore()).toBe(openStore())
})

test('a lost cookie session re-keys local progress to the new anonymous user and pushes it', async () => {
  localStorage.setItem('um.uid', 'old')
  localStorage.setItem('um.session.nf-fractions:old', '[1]')
  localStorage.setItem('um.theme', 'dark')
  const fake = fakeClient(null, 'new', [])
  const store = await boot(() => fake.client)
  await settle()
  expect(store.activeId()).toBe('new')
  expect(localStorage.getItem('um.uid')).toBe('new')
  expect(localStorage.getItem('um.session.nf-fractions:old')).toBeNull()
  expect(localStorage.getItem('um.session.nf-fractions:new')).toBe('[1]')
  expect(localStorage.getItem('um.theme')).toBe('dark')
  expect(fake.writes).toEqual([{ user_id: 'new', key: 'um.session.nf-fractions:new', value: '[1]' }])
  expect(unsyncedKeys()).toEqual([])
})

test('progress made before the first sign-in is adopted by the signed-in user', async () => {
  localStorage.setItem('um.session.nf-fractions:local', '[1]')
  const fake = fakeClient('u', 'u', [])
  await boot(() => fake.client)
  await settle()
  expect(localStorage.getItem('um.session.nf-fractions:u')).toBe('[1]')
  expect(fake.writes.map((w) => w.key)).toEqual(['um.session.nf-fractions:u'])
})

test('the server heals only what local never changed since it was last confirmed', async () => {
  localStorage.setItem('um.uid', 'u')
  localStorage.setItem('um.session.x:u', '[1,2]')
  localStorage.setItem('um.unsynced', '["um.session.x:u"]')
  const fake = fakeClient('u', 'u', [
    { key: 'um.session.x:u', value: '[1]' },
    { key: 'um.profile:u', value: 'P' },
  ])
  await boot(() => fake.client)
  await settle()
  expect(localStorage.getItem('um.session.x:u')).toBe('[1,2]')
  expect(localStorage.getItem('um.profile:u')).toBe('P')
  expect(fake.writes).toEqual([{ user_id: 'u', key: 'um.session.x:u', value: '[1,2]' }])
})

test('writes to one key reach the server in order, coalesced to the newest while one is in flight', async () => {
  const fake = fakeClient('u', 'u', [])
  const store = await boot(() => fake.client)
  store.writeItem('um.session.x:u', 'a')
  store.writeItem('um.session.x:u', 'b')
  store.writeItem('um.session.x:u', 'c')
  expect(unsyncedKeys()).toEqual(['um.session.x:u'])
  await store.flushed()
  expect(fake.writes.map((w) => w.value)).toEqual(['a', 'c'])
  expect(unsyncedKeys()).toEqual([])
})

test('a removal is a queued delete that flushed() waits for', async () => {
  const fake = fakeClient('u', 'u', [])
  const store = await boot(() => fake.client)
  store.removeItem('um.session.x:u')
  await store.flushed()
  expect(fake.writes).toEqual([{ user_id: 'u', key: 'um.session.x:u', value: null }])
})

test('without Supabase the store is local-only: writes never throw and stay marked for the next online boot', async () => {
  localStorage.setItem('um.uid', 'u')
  const store = await boot(() => {
    throw new Error('sync unavailable')
  })
  expect(store.activeId()).toBe('u')
  expect(store.writeItem('um.session.x:u', '[1]')).toBe(true)
  expect(localStorage.getItem('um.session.x:u')).toBe('[1]')
  expect(unsyncedKeys()).toEqual(['um.session.x:u'])
})

test('a failed local write is reported but still mirrored to the server, so a full disk never loses progress', async () => {
  const fake = fakeClient('u', 'u', [])
  const store = await boot(() => fake.client)
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  expect(store.writeItem('um.session.x:u', '[1]')).toBe(false)
  await store.flushed()
  expect(fake.writes).toEqual([{ user_id: 'u', key: 'um.session.x:u', value: '[1]' }])
})

test('a select that resolves with null data heals nothing and never rejects the open, so the shell still mounts', async () => {
  localStorage.setItem('um.session.x:u', '[1]')
  const fake = fakeClient('u', 'u', [], { select: { data: null, error: null } })
  const store = await boot(() => fake.client)
  await settle()
  expect(store.activeId()).toBe('u')
  expect(localStorage.getItem('um.session.x:u')).toBe('[1]')
  expect(fake.writes).toEqual([{ user_id: 'u', key: 'um.session.x:u', value: '[1]' }])
})

test("confirming one key leaves another tab's pending marker on disk intact", async () => {
  const fake = fakeClient('u', 'u', [])
  const store = await boot(() => fake.client)
  localStorage.setItem('um.unsynced', '["um.session.other:u"]')
  store.writeItem('um.session.x:u', '[1]')
  await store.flushed()
  expect(unsyncedKeys()).toEqual(['um.session.other:u'])
})

test('a write dispatched before sign-in resolves is keyed to the cached user, not local', async () => {
  localStorage.setItem('um.uid', 'u')
  let release = () => {}
  const hold = new Promise<void>((r) => (release = r))
  const fake = fakeClient('u', 'u', [], { hold })
  vi.resetModules()
  vi.doMock('./supabase-client', () => ({ supabase: () => fake.client }))
  const store = await import('./store')
  const opening = store.openStore()
  expect(store.activeId()).toBe('u')
  store.writeItem('um.session.x:u', '[1]')
  release()
  await opening
  await store.flushed()
  expect(fake.writes.some((w) => w.key === 'um.session.x:u' && w.user_id === 'u')).toBe(true)
})

test('an unconfirmed session log never discards history: the longer side wins when one extends the other, and divergent logs are concatenated', () => {
  const key = 'um.session.nf-fractions:u'
  const start = (at: number) => ({ kind: 'start', plan: { startedAt: at, blocks: [] } })
  const trial = (at: number) => ({ kind: 'trial', typed: '1', at })
  const remote = JSON.stringify([start(1), trial(2), trial(3)])
  const mine = new Set([key])
  const ahead = JSON.stringify([start(1), trial(2), trial(3), trial(4)])
  expect(mergePlan(new Map([[key, ahead]]), mine, [{ key, value: remote }])).toEqual({
    toLocal: [],
    toServer: [{ key, value: ahead }],
  })
  const behind = JSON.stringify([start(1), trial(2)])
  expect(mergePlan(new Map([[key, behind]]), mine, [{ key, value: remote }])).toEqual({
    toLocal: [{ key, value: remote }],
    toServer: [{ key, value: remote }],
  })
  const offline = JSON.stringify([start(9), trial(10)])
  const joined = JSON.stringify([start(1), trial(2), trial(3), start(9), trial(10)])
  expect(mergePlan(new Map([[key, offline]]), mine, [{ key, value: remote }])).toEqual({
    toLocal: [{ key, value: joined }],
    toServer: [{ key, value: joined }],
  })
  const profile = 'um.profile:u'
  expect(mergePlan(new Map([[profile, 'B']]), new Set([profile]), [{ key: profile, value: 'A' }])).toEqual({
    toLocal: [],
    toServer: [{ key: profile, value: 'B' }],
  })
})
