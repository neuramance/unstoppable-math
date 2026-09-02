import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { clipKey, spokenLesson, type Lesson } from '../lib/lesson'

const VOICE = 'U1xXYn8cDFT02st4a5oq'
const MODEL = 'eleven_multilingual_v2'
const FORMAT = 'mp3_44100_128'
const ATTEMPTS = 3
const SPEECH_TARGET_DBFS = -18
const PEAK_CEILING_DBFS = -1.5
const SPEECH_FLOOR_DBFS = -28
const EDGE_SHARE = 0.1
const ACTIVE_SHARE = 0.056
const WINDOW = 220
const LESSON = 'public/lessons/NF_Fractions.lesson.json'
const CLIPS = 'public/audio/lesson'
const ALIGNMENT = `${CLIPS}/alignment.json`

type Mp3 = Uint8Array<ArrayBuffer>
type Clip = { text: string; row: number; previous?: string }
type Timed = { end: number; words: [string, number][] }
type Entry = Timed & { sha: string }
type Metrics = { edgesQuiet: boolean; speech: number; peak: number }

const Aligned = z.object({ words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })) })

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (key === undefined || key === '') throw new Error('ELEVENLABS_API_KEY is not set — see .env.example')
  return key
}

async function speak(text: string, previous: string | undefined): Promise<Mp3> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, ...(previous === undefined ? {} : { previous_text: previous }) }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} ${res.statusText}: ${await res.text()}`)
  return new Uint8Array(await res.arrayBuffer())
}

function ffmpeg(args: string[], input: Mp3): Mp3 {
  return new Uint8Array(
    execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', ...args, 'pipe:1'], {
      input,
      maxBuffer: 1 << 28,
    }),
  )
}

function samples(mp3: Mp3): Float32Array {
  const raw = ffmpeg(['-f', 'f32le', '-ac', '1', '-ar', '22050'], mp3)
  return new Float32Array(raw.buffer, 0, Math.floor(raw.byteLength / 4))
}

function metricsOf(x: Float32Array): Metrics {
  const rms = (at: number) => {
    let sum = 0
    for (let k = Math.max(at, 0); k < Math.min(at + WINDOW, x.length); k++) sum += x[k] * x[k]
    return Math.sqrt(sum / WINDOW)
  }
  const windows: number[] = []
  for (let i = 0; i + WINDOW <= x.length; i += WINDOW) windows.push(rms(i))
  const peak = windows.reduce((a, v) => Math.max(a, v), rms(x.length - WINDOW))
  const tail = Math.max(rms(x.length - WINDOW), rms(x.length - 2 * WINDOW), rms(x.length - 3 * WINDOW))
  const active = windows.filter((v) => v > peak * ACTIVE_SHARE)
  const speech = Math.sqrt(active.reduce((a, v) => a + v * v, 0) / Math.max(active.length, 1))
  return {
    edgesQuiet: peak > 0 && rms(0) / peak < EDGE_SHARE && tail / peak < EDGE_SHARE,
    speech: 20 * Math.log10(speech + 1e-9),
    peak: 20 * Math.log10(peak + 1e-9),
  }
}

function normalized(mp3: Mp3, m: Metrics): Mp3 {
  const gain = Math.min(SPEECH_TARGET_DBFS - m.speech, PEAK_CEILING_DBFS - m.peak)
  if (Math.abs(gain) < 0.5) return mp3
  const encode = ['-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-f', 'mp3']
  return ffmpeg(['-af', `volume=${gain.toFixed(1)}dB`, ...encode], mp3)
}

async function take(key: string, clip: Clip): Promise<Mp3 | null> {
  const conditionings = clip.previous === undefined ? [undefined] : [clip.previous, undefined]
  for (const previous of conditionings) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const mp3 = await speak(clip.text, previous)
      const m = metricsOf(samples(mp3))
      if (m.edgesQuiet && m.speech >= SPEECH_FLOOR_DBFS) return normalized(mp3, m)
      const why = m.edgesQuiet ? `speech ${m.speech.toFixed(1)}dBFS below floor` : 'a loud edge'
      console.warn(`retry ${key}: ${previous === undefined ? 'plain' : 'conditioned'} take ${attempt} has ${why}`)
    }
  }
  return null
}

async function timed(key: string, mp3: Mp3, text: string): Promise<Timed> {
  const form = new FormData()
  form.append('file', new Blob([mp3], { type: 'audio/mpeg' }), `${key}.mp3`)
  form.append('text', text)
  const res = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey() },
    body: form,
  })
  if (!res.ok) throw new Error(`forced-alignment ${res.status} for ${key}: ${await res.text()}`)
  const aligned = Aligned.parse(await res.json())
  const words = aligned.words
    .filter((word) => word.text.trim() !== '')
    .map((word): [string, number] => [word.text.trim(), Math.round(word.start * 1000)])
  const last = aligned.words.at(-1)
  if (words.length === 0 || last === undefined) throw new Error(`no words aligned for ${key}`)
  return { end: Math.round(last.end * 1000), words }
}

function planned(lesson: Lesson): Map<string, Clip> {
  const out = new Map<string, Clip>()
  for (const item of lesson.items)
    for (const [raw, previous] of [
      [item.prompt, undefined],
      [item.demo, item.prompt],
    ] as const) {
      const text = spokenLesson(raw)
      const key = clipKey(text)
      const prior = out.get(key)
      if (prior !== undefined) {
        if (prior.text !== text) throw new Error(`clip key collision on ${key}: ${prior.text} / ${text}`)
        continue
      }
      out.set(key, { text, row: item.row, ...(previous === undefined ? {} : { previous: spokenLesson(previous) }) })
    }
  return out
}

function scopeOf(spec: string | undefined): (row: number) => boolean {
  if (spec === undefined) return () => false
  const bounds = spec.split('-').map(Number)
  const low = bounds[0]
  const high = bounds.length > 1 ? bounds[1] : low
  if (!Number.isInteger(low) || !Number.isInteger(high)) throw new Error(`rows must be N or N-M, got ${spec}`)
  return (row) => row >= low && row <= high
}

async function main(): Promise<void> {
  const inScope = scopeOf(process.argv[2])
  const lesson = JSON.parse(readFileSync(LESSON, 'utf8')) as Lesson
  const alignment = JSON.parse(readFileSync(ALIGNMENT, 'utf8')) as Record<string, Entry>
  const plan = planned(lesson)
  const missing = [...plan].filter(([key]) => alignment[key] === undefined || !existsSync(`${CLIPS}/${key}.mp3`))
  const rows = [...new Set(missing.map(([, clip]) => clip.row))].sort((a, b) => a - b)
  console.log(`${plan.size} clips the lesson speaks, ${missing.length} unrecorded, over rows ${rows.join(' ')}`)
  const failed: string[] = []
  for (const [key, clip] of missing.filter(([, clip]) => inScope(clip.row))) {
    const mp3 = await take(key, clip)
    if (mp3 === null) {
      failed.push(key)
      console.error(`${key}: every take failed the edge and loudness gates — inspect by ear`)
      continue
    }
    alignment[key] = {
      sha: createHash('sha256').update(mp3).digest('hex').slice(0, 12),
      ...(await timed(key, mp3, clip.text)),
    }
    writeFileSync(`${CLIPS}/${key}.mp3`, mp3)
    const keys = Object.keys(alignment).sort()
    writeFileSync(ALIGNMENT, `${JSON.stringify(Object.fromEntries(keys.map((k) => [k, alignment[k]])), null, 2)}\n`)
    console.log(`wrote ${key} · "${clip.text}"`)
  }
  if (failed.length > 0) throw new Error(`${failed.length} clips failed every take: ${failed.join(' ')}`)
}

await main()
