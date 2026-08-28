import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { extract } from '../scripts/extract-docx'

const committed = JSON.parse(readFileSync('content/transcription/fractions.transcription.json', 'utf8'))

test('the committed transcription is exactly what the extractor produces from the committed docx', () => {
  const fresh = extract(readFileSync('content/source/Fractions_Atoms_Lessons.docx'))
  expect(fresh).toEqual(committed)
})

test('inventory: every measured landmark of the document is present', () => {
  expect(committed.atomisation).toHaveLength(84)
  expect(committed.headaches.map((h: { title: string }) => h.title)).toEqual([
    'Headache – Part 1',
    'Headache – Part 2',
  ])
  expect(committed.preamble).toEqual([])
  const labels = committed.sections.map((s: { label: string }) => s.label)
  expect(labels).toEqual(
    ('1 2 3a 3b 3 4 5 6 9 7 8 10 11 12 13 14 14a 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 ' +
      '32a 32 33 34a 34 68 68a 68b 35 36 37a 37b 37c 38a 38b 38c 39 40 41a 41b 42 43 44a 44b 45 46 47 ' +
      '48 49 50 51 52 53 54 55a 55b 56 57 58 59 60 61 62 63a 63b 64 65 66 67 69 70 71 72 73 74 75 76 ' +
      '77 78 79 80 81 82').split(' '),
  )
  expect(new Set(labels).size).toBe(97)
  type Sec = { blocks: { II: string[]; IT: string[]; EX: string[] } }
  const withBlock = (k: 'II' | 'IT' | 'EX') => committed.sections.filter((s: Sec) => s.blocks[k].length > 0).length
  expect(withBlock('II')).toBe(94)
  expect(withBlock('IT')).toBe(90)
  expect(withBlock('EX')).toBe(62)
})

test('inline math survived: fractions, boxes, and images are rendered, comments are not', () => {
  const text = JSON.stringify(committed)
  const byLabel = new Map<string, { prompt: string }>(
    committed.atomisation.map((r: { label: string; prompt: string }) => [r.label, r]),
  )
  expect(byLabel.get('10')?.prompt).toContain('8/3')
  expect(byLabel.get('17')?.prompt).toContain('5/3 ▢ 8/3')
  const images = text.match(/\[image:image\d+\.png\]/g) ?? []
  expect(new Set(images).size).toBeGreaterThanOrEqual(30)
  expect(text).not.toContain('Want consistency with fourths')
  expect(text).not.toContain('mis-tagged the same way')
})
