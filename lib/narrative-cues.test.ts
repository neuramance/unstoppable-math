import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { cueAt, parseNarrativeCues } from './narrative'
import { lesson } from './session.fixtures'

const FILM_SEC = 54.539

const shipped = parseNarrativeCues(JSON.parse(readFileSync('public/videos/land-before-counting.cues.json', 'utf8')))

test('the asset names the film it captions, and the film it captions is the one the lesson plays', () => {
  expect(shipped.film).toBe('land-before-counting.mp4')
  expect(shipped.durationSec).toBeCloseTo(FILM_SEC, 3)
  expect(shipped.cues).toHaveLength(23)
  expect(lesson.narrative).toBe(shipped.film)
})

test('his first line is up from the first frame and his last question clears before the film ends', () => {
  expect(shipped.cues[0]).toEqual({
    index: 0,
    start: 0,
    end: 1.859,
    lines: ['Over ten thousand years ago,'],
  })
  expect(shipped.cues[22]).toEqual({
    index: 22,
    start: 52.259,
    end: 53.499,
    lines: ['How did he do it?'],
  })
})

test('a cue is at most two lines a young reader can take in', () => {
  for (const cue of shipped.cues) {
    expect(cue.lines.length).toBeGreaterThanOrEqual(1)
    expect(cue.lines.length).toBeLessThanOrEqual(2)
  }
})

test('the cues run in order, never overlap, and never outlast the film', () => {
  shipped.cues.forEach((cue, i) => {
    expect(cue.index).toBe(i)
    expect(cue.end).toBeGreaterThan(cue.start)
    expect(cue.end).toBeLessThanOrEqual(FILM_SEC)
    const previous = shipped.cues[i - 1]
    if (previous !== undefined) expect(cue.start).toBeGreaterThanOrEqual(previous.end)
  })
})

test('the line on screen is the line he is speaking', () => {
  expect(cueAt(shipped.cues, 2.5)?.lines).toEqual(['a young boy named', 'Tarek lived in a small'])
  expect(cueAt(shipped.cues, 43.0)?.lines).toEqual(['only that there', 'were a lot of them.'])
  expect(cueAt(shipped.cues, 5.0)?.lines).toEqual(['village at the edge', 'of the wild hills.'])
})

test('a cue is on screen from its own start and gone on its own end', () => {
  const second = shipped.cues[1]
  expect(cueAt(shipped.cues, second.start)?.index).toBe(1)
  expect(cueAt(shipped.cues, second.end)?.index).not.toBe(1)
})

test('nothing is drawn in the silences he left, or after his last word', () => {
  expect(cueAt(shipped.cues, 18.0)).toBeNull()
  expect(cueAt(shipped.cues, 54.0)).toBeNull()
  expect(cueAt(shipped.cues, FILM_SEC)).toBeNull()
})

test('a caption layer that has not loaded its film yet draws nothing rather than throwing', () => {
  expect(cueAt([], 3.2)).toBeNull()
  expect(cueAt(shipped.cues, 0)?.index).toBe(0)
})

test('a malformed cue file is refused at the boundary instead of reaching the screen', () => {
  expect(() => parseNarrativeCues({ film: 'x.mp4', durationSec: 10, cues: [{ index: 0, start: 0, end: 1 }] })).toThrow()
  expect(() => parseNarrativeCues({ film: 'x.mp4', cues: [] })).toThrow()
  expect(() => parseNarrativeCues('[]')).toThrow()
})
