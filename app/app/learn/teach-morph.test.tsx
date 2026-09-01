import { fireEvent, render } from '@testing-library/react'
import { act, useState } from 'react'
import { afterAll, expect, test } from 'vitest'
import nfRaw from '@/public/lessons/NF_Fractions.lesson.json'
import { morphs, turnsOnly } from '@/lib/figures'
import type { Lesson, TrialEntry } from '@/lib/lesson'
import { LessonPlayer } from './teach'

const line = (parts: number) => ({ kind: 'number-line' as const, units: 3, parts })

const MORPHABLE: Lesson = {
  topic: 'morph',
  source: 'morph',
  items: [
    {
      row: 1,
      role: 'model',
      mode: 'typed',
      prompt: 'Here are three whole units.',
      expected: 'four',
      demo: 'Four parts.',
      figures: [line(4)],
    },
    {
      row: 1,
      role: 'model',
      mode: 'typed',
      prompt: 'Watch what changes…',
      expected: 'seven',
      demo: 'Seven parts.',
      figures: [line(7)],
    },
    {
      row: 1,
      role: 'test',
      mode: 'typed',
      prompt: 'How many parts?',
      expected: 'three',
      demo: 'Three parts.',
      figures: [line(3)],
    },
  ],
}

const REDONE: Lesson = {
  topic: 'redo',
  source: 'redo',
  items: [
    {
      row: 1,
      role: 'test',
      mode: 'typed',
      prompt: 'How many parts?',
      expected: 'four',
      demo: 'Four.',
      figures: [line(4)],
    },
  ],
}

function Host({ lesson, auto = false }: { lesson: Lesson; auto?: boolean }) {
  const [log, setLog] = useState<TrialEntry[]>([])
  return (
    <LessonPlayer lesson={lesson} log={log} onTrial={(e) => setLog((l) => [...l, e])} auto={auto} onMuted={() => {}} />
  )
}

const card = () => document.querySelector('p[aria-live]')!.parentElement
const svgLines = () => [...document.querySelectorAll('svg line')]
const unitTicksOf = (lines: Element[], parts: number) => lines.slice(1).filter((_, k) => k % parts === 0)

const originalStartViewTransition = document.startViewTransition
afterAll(() => {
  document.startViewTransition = originalStartViewTransition
})

function stubTransitions() {
  const seen = { count: 0, update: null as null | (() => void) }
  document.startViewTransition = ((cb: () => void) => {
    seen.count += 1
    seen.update = cb
    return {} as ViewTransition
  }) as typeof document.startViewTransition
  return seen
}

test('a morphed advance opens no view transition and keeps the card, the svg and the unit ticks as the same nodes', () => {
  const seen = stubTransitions()
  const view = render(<Host lesson={MORPHABLE} />)
  const linesBefore = svgLines()
  const before = {
    card: card(),
    svg: document.querySelector('svg'),
    axis: linesBefore[0],
    units: unitTicksOf(linesBefore, 4),
  }
  expect(linesBefore.length - 1 - before.units.length).toBe(3 * 3)
  fireEvent.click(view.getByText('Next'))
  expect(seen.count).toBe(0)
  expect(view.getByText('Watch what changes…')).toBeTruthy()
  expect(card() === before.card).toBe(true)
  expect(document.querySelector('svg') === before.svg).toBe(true)
  const linesAfter = svgLines()
  expect(linesAfter[0] === before.axis).toBe(true)
  const unitsAfter = unitTicksOf(linesAfter, 7)
  expect(unitsAfter.length).toBe(before.units.length)
  unitsAfter.forEach((tick, i) => expect(tick === before.units[i]).toBe(true))
  expect(linesAfter.length - 1 - unitsAfter.length).toBe(3 * 6)
  view.unmount()
})

test('a morph into a test item hands focus to the answer box the remount used to hand it by mounting', () => {
  stubTransitions()
  const view = render(<Host lesson={MORPHABLE} />)
  fireEvent.click(view.getByText('Next'))
  const svg = document.querySelector('svg')
  fireEvent.click(view.getByText('Next'))
  const input = view.getByLabelText('Your answer')
  expect(document.querySelector('svg') === svg).toBe(true)
  expect(document.activeElement === input).toBe(true)
  view.unmount()
})

test('a missed item is served again as a fresh card, never as a conversion of itself', () => {
  const seen = stubTransitions()
  const view = render(<Host lesson={REDONE} />)
  const cardBefore = card()
  fireEvent.change(view.getByLabelText('Your answer'), { target: { value: 'five' } })
  fireEvent.click(view.getByText('Check'))
  act(() => seen.update!())
  expect(view.getByText('not quite')).toBeTruthy()
  fireEvent.click(view.getByText('Continue'))
  act(() => seen.update!())
  expect(view.getByText('How many parts?')).toBeTruthy()
  expect(card() === cardBefore).toBe(false)
  view.unmount()
})

const TURNING: Lesson = {
  topic: 'turn',
  source: 'turn',
  items: [
    {
      row: 1,
      role: 'model',
      mode: 'typed',
      prompt: 'A flat line.',
      expected: 'two',
      demo: 'Two.',
      figures: [{ kind: 'number-line', units: 2, parts: 3 }],
    },
    {
      row: 1,
      role: 'model',
      mode: 'typed',
      prompt: 'The same line, upright.',
      expected: 'two',
      demo: 'Two.',
      figures: [{ kind: 'number-line', units: 2, parts: 3, orientation: 'vertical' }],
    },
  ],
}

test('a step that only turns its figure arms the rotation class for that one transition and disarms after', async () => {
  const seen = { update: null as null | (() => void), finish: Promise.resolve() }
  document.startViewTransition = ((cb: () => void) => {
    seen.update = cb
    return { finished: seen.finish } as ViewTransition
  }) as typeof document.startViewTransition
  const view = render(<Host lesson={TURNING} />)
  fireEvent.click(view.getByText('Next'))
  expect(document.documentElement.classList.contains('learn-turn')).toBe(true)
  act(() => seen.update!())
  expect(view.getByText('The same line, upright.')).toBeTruthy()
  await seen.finish
  await Promise.resolve()
  expect(document.documentElement.classList.contains('learn-turn')).toBe(false)
  view.unmount()
})

test('a turn under reduced motion never arms the class: the update lands plainly', () => {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  const seen = stubTransitions()
  const view = render(<Host lesson={TURNING} />)
  fireEvent.click(view.getByText('Next'))
  expect(seen.count).toBe(0)
  expect(document.documentElement.classList.contains('learn-turn')).toBe(false)
  expect(view.getByText('The same line, upright.')).toBeTruthy()
  window.matchMedia = original
  view.unmount()
})

const shippedSets = () => {
  const nf = nfRaw as unknown as Lesson
  return [...new Set(nf.items.map((it) => it.set ?? 1))].sort().map((s) => nf.items.filter((it) => (it.set ?? 1) === s))
}

test("the shipped lesson's watch-what-changes chains are conversions: at least 13 consecutive pairs in set 1", () => {
  const counts = shippedSets().map(
    (items) => items.slice(1).filter((it, i) => morphs(items[i].figures, it.figures)).length,
  )
  expect(counts).toHaveLength(1)
  expect(counts[0]).toBeGreaterThanOrEqual(13)
})

test('the shipped lesson turns: his rotate-to-vertical steps are at least 2 consecutive pairs in set 1', () => {
  const counts = shippedSets().map(
    (items) => items.slice(1).filter((it, i) => turnsOnly(items[i].figures, it.figures)).length,
  )
  expect(counts).toHaveLength(1)
  expect(counts[0]).toBeGreaterThanOrEqual(2)
})
