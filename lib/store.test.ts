import { expect, test } from 'vitest'
import { mergePlan, openStore, synced } from './store'

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
  for (const key of ['um.theme', 'um.dev', 'um.uid', 'um.intro-seen', 'unrelated']) {
    expect({ key, synced: synced(key) }).toEqual({ key, synced: false })
  }
})

test('server rows win at boot, and only synced local-only keys push up', () => {
  const rows = [
    { key: 'um.session.nf-fractions:u', value: '[1]' },
    { key: 'um.profile:u', value: '{"name":"A"}' },
  ]
  const local = ['um.session.nf-fractions:u', 'um.lesson.nf-fractions.attempt:u', 'um.theme', 'um.uid']
  const plan = mergePlan(local, rows)
  expect(plan.toLocal).toEqual(rows)
  expect(plan.toServer).toEqual(['um.lesson.nf-fractions.attempt:u'])
})

test('opening the store twice is one open: StrictMode double-mounts must not race two sign-ins', () => {
  expect(openStore()).toBe(openStore())
})

test('an empty side is legal on both ends', () => {
  expect(mergePlan([], [])).toEqual({ toLocal: [], toServer: [] })
  expect(mergePlan(['um.session.x:u'], []).toServer).toEqual(['um.session.x:u'])
  const rows = [{ key: 'um.session.x:u', value: '[]' }]
  expect(mergePlan([], rows)).toEqual({ toLocal: rows, toServer: [] })
})
