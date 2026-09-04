import type { CountKind, Figure } from './figures'
export type FracSlots = {
  whole?: string | null
  num: string | null
  den: string | null
}
export type LessonItem = {
  row: number
  role: 'model' | 'test'
  mode: 'typed' | 'frac' | 'shade'
  set?: number
  prompt: string
  expected: string
  demo: string
  count?: CountKind
  figures?: Figure[]
  expr?: string
  frac?: FracSlots
  accept?: string[]
}
export type Lesson = {
  topic: string
  source: string
  atoms?: Record<string, string>
  narrative?: string
  items: LessonItem[]
}
export const FIRM_SHARE = 1
export const CARDINALS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
]
const NUMBER_WORDS: Record<string, number> = {
  ...Object.fromEntries(CARDINALS.map((w, i) => [w, i])),
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}
const QUOTED_OPEN = /^["'“”‘’]+/
const QUOTED_CLOSE = /[.,!?"'“”‘’]+$/
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?<=[a-z])-(?=[a-z])/g, ' ')
    .split(/\s+/)
    .map((tok) => tok.replace(QUOTED_OPEN, '').replace(QUOTED_CLOSE, ''))
    .filter(Boolean)
    .map((tok) => (NUMBER_WORDS[tok] !== undefined ? String(NUMBER_WORDS[tok]) : tok))
    .join(' ')
}
const ORDINALS_FROM_HALF = [
  'half',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
]
const TENS_ORDINALS = ['thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth', 'eightieth', 'ninetieth']
const UNIT_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth']
const plurals = (stems: string[], value: (i: number) => number): Record<string, number> =>
  Object.fromEntries(
    stems.flatMap((stem, i) => [
      [stem, value(i)],
      [`${stem}s`, value(i)],
    ]),
  )
const DENOMINATORS: Record<string, number> = {
  ...plurals(ORDINALS_FROM_HALF, (i) => i + 2),
  ...plurals(TENS_ORDINALS, (i) => (i + 3) * 10),
  halves: 2,
  quarter: 4,
  quarters: 4,
  hundredth: 100,
  hundredths: 100,
  thousandth: 1000,
  thousandths: 1000,
}
const COMPOUND_UNITS = plurals(UNIT_ORDINALS, (i) => i + 1)
export function symbolize(text: string): string {
  return normalizeAnswer(text)
    .replace(/\bgreater than\b/g, '>')
    .replace(/\bless than\b/g, '<')
    .replace(/\bequals?(?: to)?\b/g, '=')
    .replace(/\b(?:out of|slash)\b/g, 'over')
    .replace(/\b([2-9]0) ([1-9])\b/g, (_, tens: string, unit: string) => String(Number(tens) + Number(unit)))
    .replace(/\b(\d+) hundred(?: and)?(?: (\d+))?\b/g, (_, group: string, rest: string | undefined) =>
      String(Number(group) * 100 + Number(rest ?? 0)),
    )
    .replace(/\b(\d+) ([2-9]0) ([a-z]+)\b/g, (whole, num: string, tens: string, word: string) =>
      COMPOUND_UNITS[word] === undefined ? whole : `${num} over ${Number(tens) + COMPOUND_UNITS[word]}`,
    )
    .replace(/\s+and\s+/g, ' ')
    .replace(/\b[a-z]+\b/g, (word) => (DENOMINATORS[word] === undefined ? word : `over ${DENOMINATORS[word]}`))
    .replace(/\b(\d+) over (\d+)\b/g, '$1/$2')
}
function numbersOf(text: string): number[] {
  return text
    .split(/[\s/,]+/)
    .filter(Boolean)
    .map(Number)
}
function filledFraction(item: LessonItem): number[] | null {
  if (!item.frac) return null
  const slots = [...(item.frac.whole === undefined ? [] : [item.frac.whole]), item.frac.num, item.frac.den]
  const want = numbersOf(item.expected)
  let next = 0
  return slots.flatMap((s) => (s === null ? [want[next++]] : numbersOf(s)))
}
export function gradeItem(item: LessonItem, typed: string): boolean {
  if (item.mode === 'typed') {
    const got = normalizeAnswer(typed)
    return [item.expected, ...(item.accept ?? [])].some((a) => normalizeAnswer(a) === got)
  }
  const got = numbersOf(typed)
  const matches = (want: number[]) => got.length === want.length && want.every((w, i) => got[i] === w)
  const full = filledFraction(item)
  return matches(numbersOf(item.expected)) || (full !== null && typed.includes('/') && matches(full))
}
export function heardAnswer(item: LessonItem, heard: readonly string[]): string {
  for (const text of heard)
    for (const candidate of [text, symbolize(text)]) if (gradeItem(item, candidate)) return candidate
  return heard[0] ?? ''
}
export type TrialEntry = {
  typed: string
}
export type Step = {
  item: number
  correction: boolean
}
export type LessonState = {
  current: Step | null
  done: boolean
  originalDone: number
  gradedCount: number
  rightFirstTry: number
  firm: boolean
  lastCorrect: boolean | null
}
function isFirm(rightFirstTry: number, gradedCount: number): boolean {
  console.assert(gradedCount >= 0)
  console.assert(rightFirstTry >= 0)
  return gradedCount === 0 || rightFirstTry / gradedCount >= FIRM_SHARE
}
export function replayLesson(lesson: Lesson, log: TrialEntry[]): LessonState {
  const queue: Step[] = lesson.items.map((_, i) => ({ item: i, correction: false }))
  const firstTry = new Map<number, boolean>()
  let originalDone = 0
  let lastCorrect: boolean | null = null
  for (const entry of log) {
    const step = queue.shift()
    if (!step) throw new Error('trial log overruns the lesson')
    const item = lesson.items[step.item]
    const model = item.role === 'model'
    const correct = model || gradeItem(item, entry.typed)
    if (!step.correction) {
      originalDone += 1
      if (!model) firstTry.set(step.item, correct)
    }
    lastCorrect = model ? null : correct
    if (!model && !correct) {
      if (step.correction) queue.unshift({ item: step.item, correction: true })
      else {
        const insert: Step[] = [{ item: step.item, correction: true }]
        if (step.item > 0) insert.push({ item: step.item - 1, correction: true }, { item: step.item, correction: true })
        queue.unshift(...insert)
      }
    }
  }
  const gradedCount = lesson.items.filter((it) => it.role !== 'model').length
  const rightFirstTry = [...firstTry.values()].filter(Boolean).length
  const done = queue.length === 0
  return {
    current: queue[0] ?? null,
    done,
    originalDone,
    gradedCount,
    rightFirstTry,
    firm: done && isFirm(rightFirstTry, gradedCount),
    lastCorrect,
  }
}
export const SPEAKABLE = /^[A-Za-z0-9 ,.?:;!'"()/…-]*$/
export function spokenLesson(text: string): string {
  return text
    .replaceAll('*', '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}
const PLURAL_DENOMINATOR: Record<string, string> = { half: 'halves' }
const OPERATOR_WORDS: Record<string, string> = {
  '+': 'plus',
  '×': 'times',
  '÷': 'divided by',
  '=': 'equals',
  '<': 'is less than',
  '>': 'is greater than',
}

function denominatorName(den: number): string | undefined {
  if (den === 100) return 'hundredth'
  if (den === 1000) return 'thousandth'
  return ORDINALS_FROM_HALF[den - 2]
}

function fractionWords(num: string, den: string): string {
  const name = denominatorName(Number(den))
  const cardinal = CARDINALS[Number(num)]
  if (name === undefined || cardinal === undefined) return `${num} over ${den}`
  return `${cardinal} ${Number(num) === 1 ? name : (PLURAL_DENOMINATOR[name] ?? `${name}s`)}`
}

const PURE_MATHS = /^[\d/▢()+×÷=<>√³⁵\s.,-]+$/
const NESTED_FRACTION = /\(([^()]+)\)\s*\/\s*(\(([^()]+)\)|[\dA-Za-z]+)/g
const ROOT_WORDS: Record<string, string> = { '': 'square', '³': 'cube', '⁵': 'fifth' }

function withoutSlots(text: string): string {
  if (!text.includes('▢')) return text
  return text
    .split(' ')
    .filter((word) => !word.includes('▢') && !PURE_MATHS.test(word))
    .join(' ')
}

function overParens(text: string): string {
  let out = text
  for (let pass = 0; pass < 6; pass++) {
    const next = out
      .replace(NESTED_FRACTION, (_, num: string, den: string) => `${num} over ${den.replace(/[()]/g, '')}`)
      .replace(/([\dA-Za-z]+)\s*\/\s*\(([^()]+)\)/g, '$1 over $2')
      .replace(/(\d+)\s*\/\s*([A-Za-z]+)/g, '$1 over $2')
      .replace(/([A-Za-z]+)\s*\/\s*(\d+)/g, '$1 over $2')
      .replace(/([A-Za-z]+)\s*\/\s*([A-Za-z]+)/g, '$1 over $2')
      .replace(/\(([^()]+)\)/g, '$1')
    if (next === out) return out
    out = next
  }
  return out
}

export function narrated(text: string): string {
  return spokenLesson(
    overParens(
      withoutSlots(spokenLesson(text.replaceAll('*', '').replace(/(\d) ?\(/g, '$1 × (')))
        .replace(/([³⁵]?)√\s*(\d+)/g, (_, index: string, n: string) => `${ROOT_WORDS[index]} root of ${n}`)
        .replace(/(\d)\s*-\s*(\d)/g, '$1 minus $2'),
    )
      .replace(/(\d+)\s*\/\s*(\d+)/g, (_, num: string, den: string) => fractionWords(num, den))
      .replace(/[+×÷=<>]/g, (op) => ` ${OPERATOR_WORDS[op]} `)
      .replace(/▢/g, ' ')
      .replace(/[()]/g, ' '),
  )
}

export function hashLane(text: string, basis: number, prime: number): number {
  let h = basis >>> 0
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), prime) >>> 0
  return h
}

export function hex32(word: number): string {
  return word.toString(16).padStart(8, '0')
}

export function clipKey(text: string): string {
  const hex = hex32(hashLane(text, 0x811c9dc5, 0x01000193))
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return slug === '' ? hex : `${slug}-${hex}`
}
