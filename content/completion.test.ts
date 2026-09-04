import { expect, test } from 'vitest'
import { gradeItem, spokenLesson, symbolize } from '../lib/lesson'
import { LessonData, LessonFile } from '../lib/lesson-schema'
import { lesson } from '../lib/session.fixtures'
import { rowFingerprint } from '../lib/session'
import { buildLesson, readAtomFiles } from '../scripts/build-lesson'

const atoms = readAtomFiles()

test('all 97 atoms have questions, and only Kris’s two intentional check-only atoms lack models', () => {
  expect(atoms.size).toBe(97)
  expect([...atoms.values()].filter((atom) => atom.items.every((i) => i.role === 'test')).map((a) => a.label)).toEqual([
    '10',
    '11',
  ])
  expect([...atoms.values()].every((atom) => atom.items.some((i) => i.role === 'test'))).toBe(true)
  const files = new Map(atoms)
  files.delete('44b')
  expect(() => buildLesson([...atoms.keys()], files)).toThrow('missing atom files: 44b')
})

test('every choice has exactly one gradable answer and rejects every distractor', () => {
  const questions = lesson.items.filter((item) => item.mode === 'choice')
  expect(questions).toHaveLength(107)
  for (const item of questions)
    expect(
      item.choices.filter((choice) => gradeItem(item, choice)),
      item.prompt,
    ).toEqual([item.expected])
})

test('bad interaction data fails at the same boundary used by the build and browser', () => {
  const modes = ['choice', 'construct', 'shade-fraction', 'line-fractions', 'decompose']
  for (const mode of modes) {
    const item = lesson.items.find((i) => i.mode === mode)!
    expect(LessonFile.safeParse({ ...lesson, items: [{ ...item, expected: 'invalid' }] }).success, mode).toBe(false)
  }
  const fraction = lesson.items.find((i) => i.mode === 'frac')!
  expect(LessonFile.safeParse({ ...lesson, items: [{ ...fraction, frac: undefined }] }).success).toBe(false)
  const choice = lesson.items.find((i) => i.mode === 'choice')!
  expect(LessonFile.safeParse({ ...lesson, items: [{ ...choice, accept: ['yes'] }] }).success).toBe(false)
  expect(
    LessonFile.safeParse({
      ...lesson,
      items: [{ ...fraction, figures: [{ kind: 'grid', units: 1, parts: 18, counted: 19, columns: 5 }] }],
    }).success,
  ).toBe(false)
})

test('calculated values accept equivalent forms, while prescribed denominators remain mandatory', () => {
  const value = lesson.items.find((i) => i.match === 'value' && i.expected === '18/4')!
  for (const answer of ['18/4', '9/2', '4 1/2', '4.5', '450000000/100000000'])
    expect(gradeItem(value, answer), answer).toBe(true)
  for (const answer of ['18/5', '4.50000000000000001', '4 1/0', '4 1', 'NaN', 'Infinity'])
    expect(gradeItem(value, answer), answer).toBe(false)
  const prescribed = lesson.items.find((i) => i.row === 87 && i.role === 'test' && i.expected === '40')!
  expect(gradeItem(prescribed, '40/100')).toBe(true)
  expect(gradeItem(prescribed, '2/5')).toBe(false)
})

test('typed mathematical expressions ignore spacing and recognize ordinary multiplication notation', () => {
  const difference = lesson.items.find((i) => i.expected === '5/8-2/8')!
  expect(gradeItem(difference, '5 / 8 - 2 / 8')).toBe(true)
  expect(gradeItem(difference, '5/8 + 2/8')).toBe(false)
  const product = lesson.items.find((i) => i.expected === '10 × 2/5')!
  expect(gradeItem(product, '10*2/5')).toBe(true)
  expect(gradeItem(product, '10 x 2/5')).toBe(true)
  expect(gradeItem(product, '10 + 2/5')).toBe(false)
  const mixed = { ...product, expected: '2 1/3' }
  expect(gradeItem(mixed, '21/3')).toBe(false)
  expect(gradeItem(mixed, '2 1 / 3')).toBe(true)
})

test('the number-line atom always supplies its source diagram, including mixed-number and five-fraction tasks', () => {
  const items = atoms.get('28')!.items
  expect(items).toHaveLength(12)
  expect(items.every((item) => item.numberLine !== undefined && item.figures === undefined)).toBe(true)
  expect(items.at(-1)!.numberLine).toHaveLength(5)
})

test('place-value questions label the digit’s value without asserting false decimal equalities', () => {
  const items = atoms.get('79')!.items
  for (const [src, digit] of [
    ['EX:2b', '6'],
    ['EX:3b', '3'],
    ['EX:4b', '8'],
  ])
    expect(items.find((item) => item.src === src)!.expr).toBe(`Value of the ${digit} =`)
})

test('unmodified lesson content retains its previous progress fingerprint', () => {
  expect(rowFingerprint(lesson, { row: 1, set: 1 }, 'atom')).toBe('0745d8d34e5e278f')
  const item = lesson.items.find((i) => i.match === 'value')!
  const original = { ...lesson, items: [{ ...item, match: undefined }] }
  expect(rowFingerprint(original, { row: item.row, set: 1 }, 'atom')).not.toBe(
    rowFingerprint({ ...lesson, items: [item] }, { row: item.row, set: 1 }, 'atom'),
  )
})

test('the player validates generic lessons and preserves the existing default set', () => {
  const item = { ...lesson.items[0], set: undefined }
  const generic = { topic: 'progress-test', source: 'test', items: [item] }
  expect(LessonData.parse(generic).items[0].set).toBe(1)
  expect(LessonFile.safeParse(generic).success).toBe(false)
  expect(LessonData.safeParse({ ...generic, items: [{ ...item, mode: 'unknown' }] }).success).toBe(false)
})

test('every stated multiplication fact in feedback is arithmetically correct', () => {
  const facts = lesson.items.flatMap((item) => [
    ...spokenLesson(item.demo).matchAll(/([\w-]+) times ([\w-]+) is (?:equal to )?([\w-]+)/gi),
  ])
  expect(facts).toHaveLength(77)
  for (const fact of facts)
    expect(Number(symbolize(fact[1])) * Number(symbolize(fact[2])), fact[0]).toBe(Number(symbolize(fact[3])))
})

test('equivalence teaching includes non-integer multipliers and marks unproved equations as questions', () => {
  const a = atoms.get('44a')!.items
  expect(a.find((item) => item.src === 'II:16')!.demo).toContain('Three times four is twelve.')
  const example = a.find((item) => item.src === 'II:22a')!
  expect(example.prompt).toContain('6/9 and 4/6')
  expect(example.demo).toContain('Both fractions simplify to *2/3*')
  const b = atoms.get('44b')!.items
  expect(b.find((item) => item.src === 'IT:8')!.expr).toBe('20/12 ?= 5/6 ×')
  expect(b.find((item) => item.src === 'IT:10')!.expected).toBe('no')
})
