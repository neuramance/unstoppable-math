import { expect, test } from 'vitest'
import {
  clipKey,
  FIRM_SHARE,
  gradeItem,
  heardAnswer,
  normalizeAnswer,
  replayLesson,
  narrated,
  spokenLesson,
} from './lesson'
import type { Lesson, TrialEntry } from './lesson'
import { item, lesson } from './session.fixtures'

test('every row carries at least one graded item', () => {
  for (const row of new Set(lesson.items.map((it) => it.row))) {
    const graded = lesson.items.filter((it) => it.row === row && it.role !== 'model').length
    expect({ row, hasGraded: graded > 0 }).toEqual({ row, hasGraded: true })
  }
})

test('a perfect run serves every item once, comes out firm, and the log cannot overrun the lesson', () => {
  expect(FIRM_SHARE).toBe(1)
  const log = lesson.items.map((it): TrialEntry => ({ typed: it.role === 'model' ? '' : it.expected }))
  const state = replayLesson(lesson, log)
  expect(state).toMatchObject({ done: true, firm: true, originalDone: lesson.items.length })
  expect(state.rightFirstTry).toBe(state.gradedCount)
  expect(() => replayLesson(lesson, [...log, { typed: 'extra' }])).toThrow()
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

test('a wrong retest repeats without growing the correction', () => {
  let retests = 0
  const { visited, state } = trace(synth('ttt'), (i, c) => i === 2 && (!c || retests++ < 3))
  expect(visited).toBe('0 1 2 2c 2c 2c 2c 1c 2c')
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

test('a fraction with one blank slot accepts the slot alone or the whole fraction it completes, typed or spoken', () => {
  const den = { ...item('frac', '2'), frac: { num: '2', den: null } }
  expect(gradeItem(den, '2')).toBe(true)
  expect(gradeItem(den, '2/2')).toBe(true)
  expect(gradeItem(den, '2 2')).toBe(false)
  expect(gradeItem(den, '2,2')).toBe(false)
  expect(gradeItem(den, '3/2')).toBe(false)
  expect(gradeItem(den, '2/3')).toBe(false)
  expect(gradeItem(den, heardAnswer(den, ['two halves']))).toBe(true)
  const num = { ...item('frac', '3'), frac: { num: null, den: '17' } }
  expect(gradeItem(num, '3/17')).toBe(true)
  expect(gradeItem(num, '17/3')).toBe(false)
  const mixed = { ...item('frac', '3/5'), frac: { whole: '2', num: null, den: null } }
  expect(gradeItem(mixed, '2 3/5')).toBe(true)
  expect(gradeItem(mixed, '3/5')).toBe(true)
  expect(gradeItem(mixed, '2 5/3')).toBe(false)
  const bare = { ...item('frac', '5'), frac: { num: '', den: null } }
  expect(gradeItem(bare, '5')).toBe(true)
  expect(gradeItem(bare, '5/5')).toBe(false)
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
  expect(narrated('(⁵√7)/19 × 20/(3x)')).toBe('fifth root of 7 over 19 times 20 over 3x')
  expect(narrated('(9-2 + ³√5)/4')).toBe('9 minus 2 plus cube root of 5 over 4')
  expect(narrated('(3 (5) + 4)/5')).toBe('3 times 5 plus 4 over 5')
  expect(narrated('(8 + 8)/20  12/20  (8 + 12)/20')).toBe('8 plus 8 over 20 twelve twentieths 8 plus 12 over 20')
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
