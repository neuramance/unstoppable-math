import { expect, test } from 'vitest'
import { gradeItem, heardAnswer, normalizeAnswer, symbolize } from './lesson'
import { item, lesson } from './session.fixtures'

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
const TENS_ORDINALS = ['thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth', 'eightieth', 'ninetieth']
const UNIT_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth']

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
  if (d > 20 && d < 100 && d % 10 === 0) return `${TENS_ORDINALS[d / 10 - 3]}s`
  if (d > 20 && d < 100) return `${TENS[Math.floor(d / 10) * 10]} ${UNIT_ORDINALS[(d % 10) - 1]}s`
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

test('denominators past twenty are heard as ordinals, plain and compound', () => {
  expect(symbolize('eleven fortieths')).toBe('11/40')
  expect(symbolize('three thirtieths')).toBe('3/30')
  expect(symbolize('one seventy-second')).toBe('1/72')
  expect(symbolize('five thirty-sixths')).toBe('5/36')
  expect(symbolize('two twenty-firsts')).toBe('2/21')
  expect(symbolize('ninety ninths')).toBe('90/9')
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
