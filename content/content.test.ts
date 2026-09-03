import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { badgeCount, shadeable } from '../lib/figures'
import { clipKey, gradeItem, narrated, normalizeAnswer, SPEAKABLE, spokenLesson, type LessonItem } from '../lib/lesson'
import { lesson } from '../lib/session.fixtures'
import { buildLesson, LessonFile, readAtomFiles } from '../scripts/build-lesson'
import { extract, type Transcription } from '../scripts/extract-docx'

const committed = JSON.parse(readFileSync('content/transcription/fractions.transcription.json', 'utf8'))

test('the committed transcription is exactly what the extractor produces from the committed docx', () => {
  const fresh = extract(readFileSync('content/source/Fractions_Atoms_Lessons.docx'))
  expect(fresh).toEqual(committed)
})

test('inventory: every measured landmark of the document is present', () => {
  expect(committed.atomisation).toHaveLength(84)
  expect(committed.headaches.map((h: { title: string }) => h.title)).toEqual(['Headache – Part 1', 'Headache – Part 2'])
  expect(committed.preamble).toEqual([])
  const labels = committed.sections.map((s: { label: string }) => s.label)
  expect(labels).toEqual(
    (
      '1 2 3a 3b 3 4 5 6 9 7 8 10 11 12 13 14 14a 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 ' +
      '32a 32 33 34a 34 68 68a 68b 35 36 37a 37b 37c 38a 38b 38c 39 40 41a 41b 42 43 44a 44b 45 46 47 ' +
      '48 49 50 51 52 53 54 55a 55b 56 57 58 59 60 61 62 63a 63b 64 65 66 67 69 70 71 72 73 74 75 76 ' +
      '77 78 79 80 81 82'
    ).split(' '),
  )
  expect(new Set(labels).size).toBe(97)
  type Sec = { blocks: { II: string[]; IT: string[]; EX: string[] } }
  const withBlock = (k: 'II' | 'IT' | 'EX') => committed.sections.filter((s: Sec) => s.blocks[k].length > 0).length
  expect(withBlock('II')).toBe(94)
  expect(withBlock('IT')).toBe(90)
  expect(withBlock('EX')).toBe(62)
})

const transcription = committed as Transcription
const allAtoms = readAtomFiles()
const filter = process.env.ATOMS?.split(',').map((s) => s.trim())
const atoms = filter === undefined ? allAtoms : new Map([...allAtoms].filter(([label]) => filter.includes(label)))
const items = () => [...atoms.values()].flatMap((f) => f.items)

test.skipIf(filter !== undefined)(
  'the committed lesson is exactly what the build produces from the committed atom files',
  () => {
    const built = buildLesson(
      transcription.sections.map((s) => s.label),
      atoms,
    )
    expect(built).toEqual(lesson)
    LessonFile.parse(lesson)
  },
)

const honed = JSON.parse(readFileSync('content/umath1-set1.baseline.json', 'utf8')) as LessonItem[]

const SCRIPT_CORRECTED: Record<number, Partial<LessonItem>> = {
  26: { prompt: "These whole units have six parts each. What's the name of each part?" },
  27: { prompt: "These whole units have seven parts each. What's the name of each part?" },
  28: { prompt: 'Your turn. How many parts in each whole unit?' },
  30: { prompt: 'How many parts in each whole unit?' },
  32: { prompt: 'How many parts in each whole unit?' },
  34: { prompt: 'How many parts in each whole unit?' },
  36: { prompt: 'How many parts in each whole unit?' },
  38: { prompt: 'How many parts in each whole unit?' },
  40: {
    prompt:
      'There are three times when the number of parts has an unusual name. If the number of parts is two, we call them halves. Say halves:',
  },
  43: { prompt: 'How many parts in each whole unit?' },
  45: { prompt: 'How many parts in each whole unit?' },
  47: { prompt: 'How many parts in each whole unit?' },
}

const REASON_ACCEPTED: Record<number, Partial<LessonItem>> = {
  60: { accept: ['Yes, because the parts are the same size.'] },
  61: { accept: ['Yes, because the parts are the same size.'] },
  62: { accept: ['No, because the parts are not the same size.'] },
}

test('the first five atoms serve the lesson umath_1 honed, bar reviewed corrections', () => {
  expect(honed).toHaveLength(62)
  const want = honed.map((item, at) => ({ ...item, ...SCRIPT_CORRECTED[at + 1], ...REASON_ACCEPTED[at + 1] }))
  expect(lesson.items.filter((item) => item.row <= 5)).toEqual(want)
})

test('every correction drops wording the committed script never had, and 11 of the 12 quote it outright', () => {
  const sections = new Map(transcription.sections.map((s) => [s.label, s]))
  const flat = (text: string) => text.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
  const scriptOf = (at: string) => {
    const label = String(lesson.atoms?.[String(honed[Number(at) - 1].row)])
    const section = sections.get(label)
    expect(section, `no section for atom ${label}`).toBeDefined()
    const blocks = (['II', 'IT', 'EX'] as const).flatMap((kind) => section?.blocks[kind] ?? [])
    return flat(blocks.join(' ').replace(/\[[^\]]*\]/g, ' '))
  }
  const corrections = Object.entries(SCRIPT_CORRECTED)
  expect(corrections).toHaveLength(12)
  for (const [at, correction] of corrections) {
    const replaced = flat(honed[Number(at) - 1].prompt)
    expect(correction.prompt, `correction at ${at} changes no prompt`).toBeDefined()
    expect(scriptOf(at).includes(replaced), `the script already said it at ${at}: ${replaced}`).toBe(false)
  }
  const quoted = corrections.filter(([at, correction]) => scriptOf(at).includes(flat(correction.prompt ?? '')))
  expect(quoted).toHaveLength(11)
})

test('every line the honed first five atoms speak is recorded', () => {
  const clips = new Set(Object.keys(JSON.parse(readFileSync('public/audio/lesson/alignment.json', 'utf8'))))
  const spoken = lesson.items
    .filter((item) => item.row <= 5)
    .flatMap((item) => [item.prompt, item.demo])
    .map(narrated)
  expect(spoken.filter((text) => !clips.has(clipKey(text)))).toEqual([])
})

test('every line the whole lesson speaks renders to speech the clip library can hold', () => {
  const spoken = lesson.items.flatMap((item) => [item.prompt, item.demo]).map(narrated)
  expect(spoken.filter((text) => !SPEAKABLE.test(text))).toEqual([])
  expect(spoken.filter((text) => /[▢×÷√=<>+/]/.test(text))).toEqual([])
  expect(new Set(spoken).size).toBe(2116)
})

test('every count item expects exactly what its figure shows', () => {
  for (const item of items()) {
    if (item.count === undefined) continue
    const fig = item.figures?.[0]
    expect(fig, `count item without a figure: ${item.prompt}`).toBeDefined()
    if (fig === undefined) continue
    const want = badgeCount(item.count, fig, fig.counted ?? 0)
    const got = Number(normalizeAnswer(item.expected).split(' ')[0])
    expect({ prompt: item.prompt, expected: item.expected, derived: got }).toEqual({
      prompt: item.prompt,
      expected: item.expected,
      derived: want,
    })
  }
})

test('frac and shade items stay inside their figures', () => {
  for (const item of items()) {
    if (item.mode === 'shade') {
      const fig = item.figures?.[0]
      expect(fig, `shade item without a figure: ${item.prompt}`).toBeDefined()
      if (fig === undefined) continue
      expect(shadeable(fig.kind)).toBe(true)
      const cells = fig.units * fig.parts
      for (const n of item.expected.split(/[\s,]+/).map(Number)) {
        expect(n).toBeGreaterThan(0)
        expect(n).toBeLessThanOrEqual(cells)
      }
    }
    if (item.mode === 'frac' && item.figures?.[0] !== undefined) {
      const fig = item.figures[0]
      const nums = item.expected.split(/[\s/]+/).map(Number)
      for (const n of nums) {
        expect(Number.isInteger(n), `non-numeric frac expected: ${item.expected}`).toBe(true)
      }
      const legal = new Set([fig.parts, fig.counted ?? -1, fig.units, fig.units * fig.parts])
      expect(
        nums.some((n) => legal.has(n)),
        `frac expected ${item.expected} names none of parts/counted/units for ${JSON.stringify(fig)}`,
      ).toBe(true)
    }
  }
})

test('every test item grades its own expected answer as correct', () => {
  for (const item of items()) {
    if (item.role !== 'test') continue
    const graded: LessonItem = { row: 1, ...item }
    expect(gradeItem(graded, item.expected), `self-grade failed: ${item.prompt} → ${item.expected}`).toBe(true)
  }
})

const ASKS_WHY = /how do you know|why\?|how can you tell/i
const ONE_SENTENCE = /^[^.!?]*[.!?]?$/

test('a graded item that asks for a reason accepts the reason it models', () => {
  const reasoned = items().filter((item) => {
    if (item.role !== 'test' || item.mode !== 'typed' || !ASKS_WHY.test(item.prompt)) return false
    const modelled = spokenLesson(item.demo).trim()
    return ONE_SENTENCE.test(modelled) && normalizeAnswer(modelled) !== normalizeAnswer(item.expected)
  })
  expect(reasoned).toHaveLength(66)
  for (const item of reasoned) {
    const modelled = spokenLesson(item.demo).trim()
    const graded: LessonItem = { row: 1, ...item }
    expect(gradeItem(graded, modelled), `rejects its own model: ${item.prompt} -> ${modelled}`).toBe(true)
    expect(gradeItem(graded, item.expected), `rejects the short answer: ${item.prompt}`).toBe(true)
  }
})

test('every item traces to a real line of its section, in document order, covering every question line', () => {
  const sections = new Map(transcription.sections.map((s) => [s.label, s]))
  const BLOCK_ORDER = { II: 1, IT: 2, EX: 3 }
  for (const [label, file] of atoms) {
    const section = sections.get(label)
    expect(section, `atom file without a section: ${label}`).toBeDefined()
    if (section === undefined) continue
    let last = -1
    const covered = new Set<string>()
    for (const item of file.items) {
      const m = /^(TBL|II|IT|EX):(\d+)[a-z]?$/.exec(item.src)
      expect(m, `bad src ${item.src} in ${label}`).not.toBeNull()
      if (m === null) continue
      const block = m[1] as 'TBL' | 'II' | 'IT' | 'EX'
      const line = Number(m[2])
      if (block !== 'TBL') {
        expect(
          section.blocks[block].length,
          `${label} ${item.src} points past ${block} (${section.blocks[block].length} lines)`,
        ).toBeGreaterThanOrEqual(line)
      }
      if (block !== 'TBL') {
        const pos = BLOCK_ORDER[block as keyof typeof BLOCK_ORDER] * 1000 + line
        expect(pos, `${label}: items out of document order at ${item.src}`).toBeGreaterThanOrEqual(last)
        last = pos
      }
      covered.add(`${block}:${line}`)
      if (block === 'II') expect(item.role).toBe('model')
      else if (block !== 'TBL') expect(item.role).toBe('test')
    }
    for (const block of ['IT', 'EX'] as const) {
      section.blocks[block].forEach((line, i) => {
        if (!line.includes('[')) return
        expect(covered.has(`${block}:${i + 1}`), `${label} ${block}:${i + 1} has no item: ${line.slice(0, 60)}`).toBe(
          true,
        )
      })
    }
    if (section.blocks.II.length > 0) {
      expect(
        file.items.some((i) => i.role === 'model'),
        `${label} has II lines but no model items`,
      ).toBe(true)
    }
  }
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
