import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { clipKey } from './lesson'

const AUDIO = join(process.cwd(), 'public/audio/lesson')
const alignment = JSON.parse(readFileSync(join(AUDIO, 'alignment.json'), 'utf8')) as Record<
  string,
  { sha: string; end: number; words: [string, number][] }
>
const keys = Object.keys(alignment).sort()
const spokenOf = (key: string) => alignment[key].words.map(([w]) => w).join(' ')

test('every alignment entry names a committed mp3 clip of real bytes, and the sha proves it is that clip', () => {
  expect(keys.length).toBeGreaterThan(0)
  for (const key of keys) {
    const path = join(AUDIO, `${key}.mp3`)
    expect({ key, exists: existsSync(path) }).toEqual({ key, exists: true })
    const bytes = readFileSync(path)
    expect({
      key,
      mp3: bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
    }).toEqual({ key, mp3: true })
    expect(bytes.length).toBeGreaterThan(4000)
    const sha = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
    expect({ key, sha: alignment[key].sha }).toEqual({ key, sha })
  }
})

test('each alignment speaks its words forward in time inside its own clip', () => {
  for (const key of keys) {
    const entry = alignment[key]
    expect({ key, spoken: entry.words.length > 0 }).toEqual({ key, spoken: true })
    expect({ key, end: entry.end > 0 }).toEqual({ key, end: true })
    const times = entry.words.map(([, t]) => t)
    const forward = times.every((t, i) => t >= 0 && t <= entry.end && (i === 0 || t >= times[i - 1]))
    expect({ key, forward }).toEqual({ key, forward: true })
  }
})

test('every clip is content-addressed off the line it speaks: its key round-trips through clipKey', () => {
  for (const key of keys) {
    expect({ key, derived: clipKey(spokenOf(key)) }).toEqual({ key, derived: key })
  }
})

test('the clip key is pinned by value, because changing it orphans every committed lesson clip at once', () => {
  expect(clipKey('How many parts in each whole unit?')).toBe('how-many-parts-in-each-whole-unit-f27ddbde')
  for (const key of keys) {
    expect({ key, clean: /^[A-Za-z0-9 ,.?:;!'"()/…-]*$/.test(spokenOf(key)) }).toEqual({ key, clean: true })
  }
})

test('the slug lowercases, folds runs of non-alphanumerics to one dash, caps at 40 chars, and never ends on a dash', () => {
  expect(clipKey('Hello,  World!')).toMatch(/^hello-world-[0-9a-f]{8}$/)
  const long = clipKey('a'.repeat(60))
  expect(long).toMatch(/^a{40}-[0-9a-f]{8}$/)
  expect(clipKey('***')).toMatch(/^[0-9a-f]{8}$/)
  expect(clipKey('a'.repeat(39) + ' b')).toMatch(/^a{39}-[0-9a-f]{8}$/)
  for (const key of keys) {
    const slug = key.slice(0, -9)
    expect({ key, tidy: slug.length <= 40 && !slug.includes('--') && !slug.endsWith('-') }).toEqual({ key, tidy: true })
  }
})
