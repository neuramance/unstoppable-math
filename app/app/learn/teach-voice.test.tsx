import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { expect, test, vi } from 'vitest'
import type { Lesson } from '@/lib/lesson'
import { clipKey } from '@/lib/lesson'
import { FakeAudio, flush, Host, line, check } from './teach.fixtures'
import { scheduleCount } from './use-lesson-voice'

const prompt = () => document.querySelector<HTMLElement>('p[aria-live]')!
const badgeTexts = () => document.querySelectorAll('svg text').length
const rings = () => document.querySelectorAll('svg circle').length

const SHOWN: Lesson = {
  topic: 'shown',
  source: 'shown',
  items: [
    {
      row: 1,
      role: 'model',
      mode: 'typed',
      prompt: 'Here are three whole units.',
      expected: 'four',
      demo: 'I count four.',
      figures: [line(4)],
    },
  ],
}

test('a prompt is spoken from its content-addressed clip and its text leaves the screen', async () => {
  render(<Host />)
  await flush()
  expect(FakeAudio.plays).toEqual([`/audio/lesson/${clipKey('How many parts?')}.mp3`])
  expect(prompt().hidden).toBe(true)
})

test('a model speaks its prompt and then its demo, chained on the clip ending, with our markers lifted', async () => {
  render(<Host lesson={SHOWN} />)
  await flush()
  act(() => FakeAudio.instances[0].onended!())
  await flush()
  expect(FakeAudio.plays).toEqual([
    `/audio/lesson/${clipKey('Here are three whole units.')}.mp3`,
    `/audio/lesson/${clipKey('I count four.')}.mp3`,
  ])
})

test('a refused play puts the words back on screen and is remembered rather than blinked through', async () => {
  FakeAudio.verdict = 'reject'
  render(<Host />)
  await flush()
  expect(prompt().hidden).toBe(false)
})

test('muting keeps the question visible even when playback succeeds and captions are off', async () => {
  const view = render(<Host muted />)
  await flush()
  expect(FakeAudio.instances[0].muted).toBe(true)
  expect(prompt().hidden).toBe(false)
  view.rerender(<Host />)
  await flush()
  expect(prompt().hidden).toBe(true)
  view.rerender(<Host muted />)
  await flush()
  expect(prompt().hidden).toBe(false)
})

test('under reduced motion nothing self-starts and the text stays', async () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  render(<Host />)
  await flush()
  expect(FakeAudio.plays.length).toBe(0)
  expect(prompt().hidden).toBe(false)
})

test('autoplay never speaks', async () => {
  render(<Host auto />)
  await flush()
  expect(FakeAudio.plays.length).toBe(0)
})

test('the captions toggle puts the words back while the clip still plays, and the choice survives a remount', async () => {
  const view = render(<Host />)
  await flush()
  expect(prompt().hidden).toBe(true)
  fireEvent.click(view.getByLabelText('Captions'))
  expect(prompt().hidden).toBe(false)
  expect(localStorage.getItem('um.cc')).toBe('1')
  view.unmount()
  render(<Host />)
  await flush()
  expect(prompt().hidden).toBe(false)
})

const COUNTED: Lesson = {
  topic: 'counted',
  source: 'counted',
  items: [
    {
      row: 1,
      role: 'model',
      mode: 'typed',
      prompt: 'The whole units have been split into parts.',
      expected: 'four',
      demo: 'I count the parts like this: one, two, three, four.',
      count: 'parts',
      figures: [line(4)],
    },
  ],
}

test('each counted digit lands on the word that names it, taken in order with echoes ignored', () => {
  const words: [string, number][] = [
    ['I', 219],
    ['count', 259],
    ['the', 500],
    ['parts', 620],
    ['like', 919],
    ['this:', 1139],
    ['one,', 2059],
    ['two,', 2500],
    ['three,', 2879],
    ['four.', 3259],
  ]
  expect(scheduleCount(4, words, 6039)).toEqual([
    [1, 2059],
    [2, 2500],
    [3, 2879],
    [4, 3259],
  ])
  const echo: [string, number][] = [
    ['one,', 100],
    ['two,', 200],
    ['three,', 300],
    ['four,', 400],
    ['five,', 500],
    ['six,', 600],
    ['seven', 700],
    ['parts.', 800],
    ['Seven', 1500],
  ]
  expect(scheduleCount(7, echo, 2000).at(-1)).toEqual([7, 700])
})

test('digits without a spoken word interpolate before their anchor, and no words means the even spread', () => {
  const fiveOnly: [string, number][] = [
    ['Five', 200],
    ['whole', 600],
    ['units.', 900],
  ]
  expect(scheduleCount(5, fiveOnly, 1400)).toEqual([
    [1, 40],
    [2, 80],
    [3, 120],
    [4, 160],
    [5, 200],
  ])
  expect(scheduleCount(5, [], 3000)).toEqual([
    [1, 500],
    [2, 1000],
    [3, 1500],
    [4, 2000],
    [5, 2500],
  ])
  const disordered: [string, number][] = [
    ['two,', 800],
    ['one,', 900],
    ['three,', 700],
  ]
  const clamped = scheduleCount(3, disordered, 1000)
  expect(clamped.map(([k]) => k)).toEqual([1, 2, 3])
  expect(clamped.every(([, at], i) => i === 0 || at >= clamped[i - 1][1])).toBe(true)
})

test('a counting model starts with no digits and lands them all while the voice counts, ring on the last', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  render(<Host lesson={COUNTED} />)
  await flush()
  expect(badgeTexts()).toBe(4)
  expect(rings()).toBe(0)
  act(() => FakeAudio.instances[0].onended!())
  await flush()
  await act(() => vi.runAllTimersAsync())
  expect(badgeTexts()).toBe(8)
  expect(rings()).toBe(1)
})

const UNITS: Lesson = {
  topic: 'units',
  source: 'units',
  items: [
    {
      row: 1,
      role: 'model',
      mode: 'typed',
      prompt: 'Here there are five whole units.',
      expected: 'five',
      demo: 'Five whole units.',
      count: 'units',
      figures: [{ kind: 'number-line', units: 5, parts: 1 }],
    },
  ],
}

test('a whole-unit count never draws a badge row: the ring lands on the axis numeral instead', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  render(<Host lesson={UNITS} />)
  await flush()
  expect(badgeTexts()).toBe(6)
  expect(rings()).toBe(0)
  act(() => FakeAudio.instances[0].onended!())
  await flush()
  await act(() => vi.runAllTimersAsync())
  expect(badgeTexts()).toBe(6)
  expect(rings()).toBe(1)
})

test('a counting model whose clip is refused shows every digit at once, exactly the still picture', async () => {
  FakeAudio.verdict = 'reject'
  render(<Host lesson={COUNTED} />)
  await flush()
  expect(badgeTexts()).toBe(8)
  expect(rings()).toBe(1)
})

test('advancing hands the voice the next line and the cleanup pauses the old one first', async () => {
  const view = render(<Host />)
  await flush()
  check(view)
  await flush()
  expect(FakeAudio.plays).toEqual([
    `/audio/lesson/${clipKey('How many parts?')}.mp3`,
    `/audio/lesson/${clipKey('Four parts.')}.mp3`,
  ])
  fireEvent.click(view.getByText('Continue'))
  await flush()
  expect(FakeAudio.plays[2]).toBe(`/audio/lesson/${clipKey('And now?')}.mp3`)
})
