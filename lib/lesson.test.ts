import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import {
  FIRM_SHARE,
  clipKey,
  gradeItem,
  heardAnswer,
  lessonSet,
  normalizeAnswer,
  replayLesson,
  narrated,
  spokenLesson,
  symbolize,
} from './lesson'
import type { Lesson, LessonItem, TrialEntry } from './lesson'

const lesson = JSON.parse(readFileSync('public/lessons/NF_Fractions.lesson.json', 'utf8')) as Lesson
const lessons = [1, 2].map((s) => lessonSet(lesson, s))
const lesson1 = lessons[0]

function run(l: Lesson, answer: (item: number, correction: boolean) => string): TrialEntry[] {
  const log: TrialEntry[] = []
  for (let guard = 0; guard < l.items.length * 4 + 100; guard++) {
    const state = replayLesson(l, log)
    if (state.current === null) return log
    const it = l.items[state.current.item]
    log.push({ typed: it.role === 'model' ? '' : answer(state.current.item, state.current.correction) })
  }
  throw new Error('lesson did not terminate')
}

const firstAdjacentTest = (l: Lesson) =>
  l.items.findIndex((it, i) => it.role === 'test' && l.items[i - 1]?.role === 'test')

test('the two sets split the lesson whole, and every row of every set carries at least one graded item', () => {
  expect(lessons[0].items.length + lessons[1].items.length).toBe(lesson.items.length)
  for (const set of [1, 2]) {
    for (const row of new Set(lessons[set - 1].items.map((it) => it.row))) {
      const graded = lessons[set - 1].items.filter((it) => it.row === row && it.role !== 'model').length
      expect({ set, row, hasGraded: graded > 0 }).toEqual({ set, row, hasGraded: true })
    }
  }
})

test('a perfect run serves every item once and comes out firm, in both sets', () => {
  for (const l of lessons) {
    const log = run(l, (i) => l.items[i].expected)
    const state = replayLesson(l, log)
    expect(log.length).toBe(l.items.length)
    expect(state.done).toBe(true)
    expect(state.firm).toBe(true)
    expect(state.rightFirstTry).toBe(state.gradedCount)
  }
})

test('a miss triggers the DI correction flow: retest, back up, confirm, resume', () => {
  const items = lesson1.items
  const missIdx = firstAdjacentTest(lesson1)
  expect(missIdx).toBeGreaterThan(0)
  const missOnce = new Set<number>()
  const log: TrialEntry[] = []
  const visited: string[] = []
  while (true) {
    const state = replayLesson(lesson1, log)
    if (state.current === null) break
    const { item, correction } = state.current
    visited.push(`${item}${correction ? 'c' : ''}`)
    const wrong = item === missIdx && !correction && !missOnce.has(item)
    if (wrong) missOnce.add(item)
    log.push({ typed: items[item].role === 'model' ? '' : wrong ? 'nope' : items[item].expected })
  }
  expect(visited.join(' ')).toContain(`${missIdx} ${missIdx}c ${missIdx - 1}c ${missIdx}c ${missIdx + 1}`)
  const state = replayLesson(lesson1, log)
  expect(state.done).toBe(true)
  expect(state.rightFirstTry).toBe(state.gradedCount - 1)
})

test('a wrong retest repeats without growing the correction', () => {
  const items = lesson1.items
  const idx = firstAdjacentTest(lesson1)
  let fails = 0
  const log = run(lesson1, (i) => {
    if (i === idx && fails < 3) {
      fails += 1
      return 'nope'
    }
    return items[i].expected
  })
  expect(replayLesson(lesson1, log).done).toBe(true)
  expect(log.length).toBe(items.length + 5)
})

test('the firm line demands 100 percent first try', () => {
  const items = lesson1.items
  const testIdx = items.flatMap((it, i) => (it.role === 'test' ? [i] : []))
  const allowed = testIdx.length - Math.ceil(testIdx.length * FIRM_SHARE)
  const missSome = (k: number) => {
    const miss = new Set(testIdx.slice(0, k))
    const log = run(lesson1, (i, c) => (c || !miss.has(i) ? items[i].expected : 'nope'))
    return replayLesson(lesson1, log)
  }
  expect(missSome(allowed).firm).toBe(true)
  expect(missSome(allowed + 1).firm).toBe(false)
})

const item = (mode: LessonItem['mode'], expected: string, accept?: string[]): LessonItem => ({
  row: 1,
  role: 'test',
  mode,
  prompt: 'p',
  expected,
  demo: '*d*',
  ...(accept === undefined ? {} : { accept }),
})

test('grading: number words equal digits, accept lists work, symbol modes compare numerically', () => {
  expect(normalizeAnswer('Five fourths.')).toBe('5 fourths')
  expect(normalizeAnswer('five-fourths')).toBe('5 fourths')
  expect(normalizeAnswer('Two')).toBe(normalizeAnswer('2'))
  const r1 = item('typed', '3')
  expect(gradeItem(r1, 'three')).toBe(true)
  expect(gradeItem(r1, '2')).toBe(false)
  const r8 = item('typed', 'Bottom', ['the bottom'])
  expect(gradeItem(r8, 'the bottom')).toBe(true)
  expect(gradeItem(r8, 'top')).toBe(false)
  const r6 = item('frac', '7/5')
  expect(gradeItem(r6, ' 7 / 5 ')).toBe(true)
  expect(gradeItem(r6, '5/7')).toBe(false)
  const r12 = item('frac', '8/3')
  expect(gradeItem(r12, '8/3')).toBe(true)
  expect(gradeItem(r12, '5/3')).toBe(false)
  const r14 = item('typed', 'five fourths')
  expect(gradeItem(r14, 'five fourths')).toBe(true)
  expect(gradeItem(r14, '5/4')).toBe(false)
  const r16 = item('frac', '2 3/5')
  expect(gradeItem(r16, '2 3/5')).toBe(true)
  expect(gradeItem(r16, ' 2  3 / 5 ')).toBe(true)
  expect(gradeItem(r16, '2 3/6')).toBe(false)
  expect(gradeItem(r16, '3 2/5')).toBe(false)
  const r24 = item('shade', '3,9')
  expect(gradeItem(r24, '3,9')).toBe(true)
  expect(gradeItem(r24, '3,8')).toBe(false)
})

test('the log cannot overrun the lesson', () => {
  for (const l of lessons) {
    const log = run(l, (i) => l.items[i].expected)
    expect(() => replayLesson(l, [...log, { typed: 'extra' }])).toThrow()
  }
})

const synth = (roles: string): Lesson => ({
  topic: 'synth',
  source: 'synth',
  items: [...roles].map((r, i) => ({
    row: 1,
    role: r === 'm' ? ('model' as const) : ('test' as const),
    mode: 'typed' as const,
    prompt: 'p',
    expected: String(i),
    demo: `*${i}*`,
  })),
})

function trace(l: Lesson, wrong: (item: number, correction: boolean) => boolean) {
  const log: TrialEntry[] = []
  const visited: string[] = []
  for (let guard = 0; guard < 200; guard++) {
    const state = replayLesson(l, log)
    if (state.current === null) return { visited: visited.join(' '), state }
    const { item, correction } = state.current
    visited.push(`${item}${correction ? 'c' : ''}`)
    const it = l.items[item]
    const miss = it.role !== 'model' && wrong(item, correction)
    log.push({ typed: it.role === 'model' ? '' : miss ? 'nope' : it.expected })
  }
  throw new Error('lesson did not terminate')
}

const once = (target: number, corr = false) => {
  let spent = false
  return (i: number, c: boolean) => {
    if (spent || i !== target || c !== corr) return false
    spent = true
    return true
  }
}

test('a lesson with nothing to grade finishes firm vacuously, because 0/0 must not read as never firm', () => {
  const models = replayLesson(synth('mm'), [{ typed: '' }, { typed: '' }])
  expect(models).toMatchObject({ done: true, firm: true, gradedCount: 0, rightFirstTry: 0 })
  expect(replayLesson(synth('m'), []).firm).toBe(false)
  const mixed = synth('mt')
  expect(replayLesson(mixed, [{ typed: '' }, { typed: '1' }])).toMatchObject({ done: true, firm: true })
  const missed = replayLesson(mixed, [{ typed: '' }, { typed: 'nope' }, { typed: '1' }, { typed: '' }, { typed: '1' }])
  expect(missed).toMatchObject({ done: true, firm: false, gradedCount: 1, rightFirstTry: 0 })
})

test('a miss on the first item retests without a back-up', () => {
  const { visited, state } = trace(synth('tt'), once(0))
  expect(visited).toBe('0 0c 1')
  expect(state).toMatchObject({ done: true, firm: false, originalDone: 2, gradedCount: 2, rightFirstTry: 1 })
})

test('a miss on the last item still corrects and terminates', () => {
  const { visited, state } = trace(synth('ttt'), once(2))
  expect(visited).toBe('0 1 2 2c 1c 2c')
  expect(state).toMatchObject({ done: true, firm: false, originalDone: 3, rightFirstTry: 2 })
})

test('a back-up onto a model auto-passes, ignores input, and reports no verdict', () => {
  const l = synth('tmt')
  const log: TrialEntry[] = [{ typed: '0' }, { typed: '' }, { typed: 'nope' }, { typed: '2' }]
  expect(replayLesson(l, log).current).toEqual({ item: 1, correction: true })
  const atModel = replayLesson(l, [...log, { typed: 'ignored' }])
  expect(atModel.lastCorrect).toBe(null)
  expect(atModel.current).toEqual({ item: 2, correction: true })
  const end = replayLesson(l, [...log, { typed: 'ignored' }, { typed: '2' }])
  expect(end).toMatchObject({ done: true, firm: false, gradedCount: 2, rightFirstTry: 1 })
})

test('a miss on the back-up step repeats only that step and never re-marks first try', () => {
  const first = once(2)
  const backUp = once(1, true)
  const { visited, state } = trace(synth('ttt'), (i, c) => first(i, c) || backUp(i, c))
  expect(visited).toBe('0 1 2 2c 1c 1c 2c')
  expect(state).toMatchObject({ done: true, firm: false, rightFirstTry: 2 })
})

test('two consecutive misses run overlapping corrections, each confirmed in order', () => {
  const m1 = once(1)
  const m2 = once(2)
  const { visited, state } = trace(synth('tttt'), (i, c) => m1(i, c) || m2(i, c))
  expect(visited).toBe('0 1 1c 0c 1c 2 2c 1c 2c 3')
  expect(state).toMatchObject({ done: true, firm: false, originalDone: 4, gradedCount: 4, rightFirstTry: 2 })
})

test('replayLesson is pure: same inputs, same state, nothing mutated', () => {
  const l = synth('tt')
  const log: TrialEntry[] = [{ typed: 'nope' }, { typed: '0' }, { typed: '1' }]
  const snapL = JSON.stringify(l)
  const snapLog = JSON.stringify(log)
  expect(replayLesson(l, log)).toEqual(replayLesson(l, log))
  expect(JSON.stringify(l)).toBe(snapL)
  expect(JSON.stringify(log)).toBe(snapLog)
})

test('grading survives junk input: wrong, never a throw', () => {
  const [t] = synth('t').items
  expect(gradeItem(t, '')).toBe(false)
  expect(gradeItem({ ...t, expected: 'Top' }, '"Top."')).toBe(true)
  const frac = { ...t, mode: 'frac' as const, expected: '7/5' }
  expect(gradeItem(frac, 'x/5')).toBe(false)
  expect(gradeItem(frac, '')).toBe(false)
  expect(gradeItem(frac, '7/5/1')).toBe(false)
})

test('lessonSet: items without a set belong to set 1', () => {
  const l = synth('tt')
  l.items[1].set = 2
  expect(lessonSet(l, 1).items.map((it) => it.expected)).toEqual(['0'])
  expect(lessonSet(l, 2).items.map((it) => it.expected)).toEqual(['1'])
})

test('narrated reads the mathematics the way the corpus reads it, and leaves no symbol behind', () => {
  expect(narrated('5/10 < 18/10.')).toBe('five tenths is less than eighteen tenths.')
  expect(narrated('3/4 × 5/5 = 15/20')).toBe('three fourths times five fifths equals fifteen twentieths')
  expect(narrated('1/2 and 1/3 and 5/2')).toBe('one half and one third and five halves')
  expect(narrated('16/100 ÷ 3/1000')).toBe('sixteen hundredths divided by three thousandths')
  expect(narrated('700/744')).toBe('700 over 744')
  expect(narrated('5/8-3/8 = (5-3)/8')).toBe('five eighths minus three eighths equals 5 minus 3 over 8')
  expect(narrated('(3(5) + 4)/5')).toBe('3 times 5 plus 4 over 5')
  expect(narrated('(√7)/19 × 20/(3x)')).toBe('square root of 7 over 19 times 20 over 3x')
  expect(narrated('a/10 and x/y')).toBe('a over 10 and x over y')
  expect(narrated('Write the symbol in the blank space. 5/10 ▢ 18/10')).toBe('Write the symbol in the blank space.')
  expect(narrated('It is split into *whole units*.')).toBe('It is split into whole units.')
  expect(narrated(narrated('3/4 × 5/5'))).toBe(narrated('3/4 × 5/5'))
})

test('spokenLesson strips emphasis, folds typography to ASCII, collapses whitespace, and clipKey keys distinct lines apart', () => {
  expect(spokenLesson('It is split into *whole units*.')).toBe('It is split into whole units.')
  expect(spokenLesson('no markers')).toBe('no markers')
  expect(spokenLesson('I’m ‘sure’ of it')).toBe("I'm 'sure' of it")
  expect(spokenLesson('a – dash — here')).toBe('a - dash - here')
  expect(spokenLesson('  two  spaces\nand a break  ')).toBe('two spaces and a break')
  expect(spokenLesson(spokenLesson('I’m  here'))).toBe(spokenLesson('I’m  here'))
  expect(clipKey('a')).not.toBe(clipKey('b'))
  expect(clipKey(spokenLesson('*Five* fourths.'))).toBe(clipKey('Five fourths.'))
})

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
const TENS: Record<number, string> = {
  20: 'twenty',
  30: 'thirty',
  40: 'forty',
  50: 'fifty',
  60: 'sixty',
  70: 'seventy',
  80: 'eighty',
  90: 'ninety',
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

function saidNumber(n: number): string {
  if (n <= 20) return CARDINALS[n]
  if (n < 100 && n % 10 !== 0) return `${TENS[Math.floor(n / 10) * 10]} ${CARDINALS[n % 10]}`
  if (n < 100) return TENS[n]
  if (n < 1000 && n % 100 === 0) return `${CARDINALS[n / 100]} hundred`
  if (n < 1000) return `${CARDINALS[Math.floor(n / 100)]} hundred ${saidNumber(n % 100)}`
  return String(n)
}

const NAMED_DENOMINATORS: Record<number, string> = { 100: 'hundredths', 1000: 'thousandths' }

function saidDenominator(d: number): string {
  if (d >= 2 && d <= 20) return `${ORDINALS_FROM_HALF[d - 2]}s`
  return NAMED_DENOMINATORS[d] ?? `over ${saidNumber(d)}`
}

function saidAloud(expected: string): string | null {
  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(expected)
  if (mixed) return `${saidNumber(+mixed[1])} and ${saidNumber(+mixed[2])} ${saidDenominator(+mixed[3])}`
  const frac = /^(\d+)\/(\d+)$/.exec(expected)
  if (frac) return `${saidNumber(+frac[1])} ${saidDenominator(+frac[2])}`
  if (/^\d+$/.test(expected)) return saidNumber(+expected)
  if (expected === '>') return 'greater than'
  if (expected === '<') return 'less than'
  if (expected === '=') return 'equals'
  return /^[A-Za-z][A-Za-z' -]*$/.test(expected) ? expected.toLowerCase() : null
}

test('symbolize renders spoken arithmetic into the grammar the lesson already grades', () => {
  expect(symbolize('three fourths')).toBe('3/4')
  expect(symbolize('five over ten')).toBe('5/10')
  expect(symbolize('three out of four')).toBe('3/4')
  expect(symbolize('one half')).toBe('1/2')
  expect(symbolize('two and one third')).toBe('2 1/3')
  expect(symbolize('greater than')).toBe('>')
  expect(symbolize('less than')).toBe('<')
  expect(symbolize('equals')).toBe('=')
  expect(symbolize('twenty six')).toBe('26')
  expect(symbolize('twenty and seven hundredths')).toBe('20 7/100')
  expect(symbolize('yes')).toBe('yes')
  expect(symbolize('improper')).toBe('improper')
})

test('a tens word is a numerator on its own but a compound denominator behind one', () => {
  expect(symbolize('twenty fifths')).toBe('20/5')
  expect(symbolize('three twenty fifths')).toBe('3/25')
  expect(symbolize('thirty ninths')).toBe('30/9')
  expect(symbolize('three over twenty five')).toBe('3/25')
})

test('the item decides whether a spoken fraction wants words or symbols', () => {
  const words = item('typed', 'four eighths')
  const symbols = item('typed', '4/8')
  expect(heardAnswer(words, ['four eighths'])).toBe('four eighths')
  expect(heardAnswer(symbols, ['four eighths'])).toBe('4/8')
  expect(gradeItem(words, heardAnswer(words, ['four eighths']))).toBe(true)
  expect(gradeItem(symbols, heardAnswer(symbols, ['four eighths']))).toBe(true)
})

test('a later alternative wins when the top one is noise, and a mishear is returned verbatim', () => {
  const symbols = item('typed', '4/8')
  expect(heardAnswer(symbols, ['for eights', 'foreignths', 'four eighths'])).toBe('4/8')
  expect(heardAnswer(symbols, ['banana bread'])).toBe('banana bread')
  expect(gradeItem(symbols, heardAnswer(symbols, ['banana bread']))).toBe(false)
  expect(heardAnswer(symbols, [])).toBe('')
})

test('every speakable answer in the real lesson is recovered from its spoken form', () => {
  const spoken = lesson.items
    .filter((it) => it.role === 'test')
    .flatMap((it) => {
      const said = saidAloud(it.expected)
      return said === null ? [] : [{ it, said }]
    })
  expect(spoken.length).toBe(655)
  const missed = spoken.filter(({ it, said }) => !gradeItem(it, heardAnswer(it, [said])))
  expect(missed.map(({ it, said }) => `${it.expected} <- ${said}`)).toEqual([])
})

test('hearing never invents a correct answer: a flipped fraction stays wrong', () => {
  const flipped = lesson.items
    .filter((it) => it.role === 'test')
    .flatMap((it) => {
      const frac = /^(\d+)\/(\d+)$/.exec(it.expected)
      return frac === null || frac[1] === frac[2] ? [] : [{ it, said: `${frac[2]} over ${frac[1]}` }]
    })
  expect(flipped.length).toBe(190)
  const accepted = flipped.filter(({ it, said }) => gradeItem(it, heardAnswer(it, [said])))
  expect(accepted.map(({ it, said }) => `${it.expected} <- ${said}`)).toEqual([])
  for (const [expected, said] of [
    ['improper', 'proper'],
    ['yes', 'no'],
    ['halves', 'thirds'],
    ['>', '<'],
  ]) {
    const wrong = item('typed', expected)
    expect(gradeItem(wrong, heardAnswer(wrong, [said]))).toBe(false)
  }
})

test('number words now reach ninety, so a spoken tens answer grades like its digits', () => {
  expect(normalizeAnswer('thirty')).toBe('30')
  expect(normalizeAnswer('ninety')).toBe('90')
  expect(gradeItem(item('typed', '70'), 'seventy')).toBe(true)
})

test('hundredths and thousandths are said as words, and bare hundreds are spoken not spelled', () => {
  expect(symbolize('eighty five hundredths')).toBe('85/100')
  expect(symbolize('four and thirty one hundredths')).toBe('4 31/100')
  expect(symbolize('thirty one thousandths')).toBe('31/1000')
  expect(symbolize('one hundred')).toBe('100')
  expect(symbolize('seven hundred')).toBe('700')
  expect(symbolize('one hundred ninety')).toBe('190')
  expect(symbolize('one hundred ninety five')).toBe('195')
  expect(symbolize('one hundred and twenty')).toBe('120')
  expect(symbolize('one hundred and four')).toBe('104')
  expect(symbolize('one hundred and ninety')).toBe('190')
  const bottom = item('frac', '100')
  expect(gradeItem(bottom, heardAnswer(bottom, ['one hundred']))).toBe(true)
  expect(gradeItem(item('frac', '120'), heardAnswer(item('frac', '120'), ['one hundred and twenty']))).toBe(true)
})
