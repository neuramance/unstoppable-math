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
export function lessonSet(lesson: Lesson, set: number): Lesson {
  return { ...lesson, items: lesson.items.filter((it) => (it.set ?? 1) === set) }
}
export const FIRM_SHARE = 1
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
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
    .replace(/-/g, ' ')
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
const DENOMINATORS: Record<string, number> = {
  ...Object.fromEntries(
    ORDINALS_FROM_HALF.flatMap((stem, i) => [
      [stem, i + 2],
      [`${stem}s`, i + 2],
    ]),
  ),
  halves: 2,
  quarter: 4,
  quarters: 4,
  hundredth: 100,
  hundredths: 100,
  thousandth: 1000,
  thousandths: 1000,
}
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
      DENOMINATORS[word] < 10 ? `${num} over ${Number(tens) + DENOMINATORS[word]}` : whole,
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
export function gradeItem(item: LessonItem, typed: string): boolean {
  if (item.mode === 'typed') {
    const got = normalizeAnswer(typed)
    return [item.expected, ...(item.accept ?? [])].some((a) => normalizeAnswer(a) === got)
  }
  const want = numbersOf(item.expected)
  const got = numbersOf(typed)
  return got.length === want.length && want.every((w, i) => got[i] === w)
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
const CARDINALS = [
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

const PURE_MATHS = /^[\d/▢()+×÷=<>√\s.,-]+$/
const NESTED_FRACTION = /\(([^()]+)\)\s*\/\s*(\(([^()]+)\)|[\dA-Za-z]+)/

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
      withoutSlots(spokenLesson(text))
        .replace(/√\s*(\d+)/g, 'square root of $1')
        .replace(/(\d)\s*\(/g, '$1 × (')
        .replace(/(\d)\s*-\s*(\d)/g, '$1 minus $2'),
    )
      .replace(/(\d+)\s*\/\s*(\d+)/g, (_, num: string, den: string) => fractionWords(num, den))
      .replace(/[+×÷=<>]/g, (op) => ` ${OPERATOR_WORDS[op]} `)
      .replace(/▢/g, ' ')
      .replace(/[()]/g, ' '),
  )
}

export function clipKey(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0')
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return slug === '' ? hex : `${slug}-${hex}`
}
