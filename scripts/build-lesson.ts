import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import {
  FIGURE_KINDS,
  FIGURE_ORIENTATIONS,
  FIGURE_UNIT_MARKS,
  MAX_PARTS,
  maxPartsFor,
  maxUnitsFor,
} from '../lib/figures'
import type { Lesson } from '../lib/lesson'

const AtomFigure = z
  .strictObject({
    kind: z.enum(FIGURE_KINDS),
    units: z.number().int().min(1),
    parts: z.number().int().min(1).max(MAX_PARTS),
    counted: z.number().int().min(0).optional(),
    label: z.string().min(1).optional(),
    orientation: z.enum(FIGURE_ORIENTATIONS).optional(),
    equal: z.boolean().optional(),
    columns: z.number().int().min(1).optional(),
    unitMarks: z.enum(FIGURE_UNIT_MARKS).optional(),
    band: z.literal(true).optional(),
    bounds: z.array(z.number().gt(0).lt(1)).min(1).optional(),
  })
  .refine((f) => f.units <= maxUnitsFor(f.kind), 'too many units for this figure kind')
  .refine((f) => f.parts <= maxPartsFor(f.kind, f.units), 'too many parts for this figure kind')
  .refine(
    (f) =>
      f.bounds === undefined ||
      (f.bounds.length === f.parts - 1 && f.bounds.every((b, i, a) => i === 0 || b > a[i - 1]!)),
    'bounds must be parts - 1 ascending cuts',
  )

const FracSlots = z.strictObject({
  whole: z.string().nullable().optional(),
  num: z.string().nullable(),
  den: z.string().nullable(),
})

const AuthoredItem = z.strictObject({
  src: z.string().regex(/^(II|IT|EX|TBL):\d+[a-z]?$/),
  role: z.enum(['model', 'test']),
  mode: z.enum(['typed', 'frac', 'shade']),
  prompt: z.string().min(1),
  expected: z.string().min(1),
  demo: z.string().min(1),
  count: z.enum(['units', 'parts', 'counted']).optional(),
  figures: z.array(AtomFigure).min(1).max(2).optional(),
  expr: z.string().min(1).optional(),
  frac: FracSlots.optional(),
  accept: z.array(z.string().min(1)).min(1).optional(),
})

export const AtomFile = z.strictObject({
  label: z.string().regex(/^\d+[a-z]?$/),
  items: z.array(AuthoredItem).min(1),
})

export type AtomFileT = z.infer<typeof AtomFile>

const LessonItemSchema = AuthoredItem.omit({ src: true }).extend({
  row: z.number().int().min(1),
  set: z.number().int().min(1),
})

export const LessonFile = z.strictObject({
  topic: z.literal('nf-fractions'),
  source: z.literal('Fractions_Atoms_Lessons.docx'),
  atoms: z.record(z.string(), z.string()),
  narrative: z.literal('land-before-counting.mp4'),
  items: z.array(LessonItemSchema).min(1),
})

export function readAtomFiles(dir = 'content/atoms'): Map<string, AtomFileT> {
  const out = new Map<string, AtomFileT>()
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.items.json')) continue
    const parsed = AtomFile.parse(JSON.parse(readFileSync(`${dir}/${name}`, 'utf8')))
    if (out.has(parsed.label)) throw new Error(`duplicate atom file for label ${parsed.label}`)
    out.set(parsed.label, parsed)
  }
  return out
}

export function buildLesson(sectionLabels: string[], atoms: Map<string, AtomFileT>): Lesson {
  const covered = sectionLabels.filter((l) => atoms.has(l))
  const stray = [...atoms.keys()].filter((l) => !sectionLabels.includes(l))
  if (stray.length > 0) throw new Error(`atom files without a transcription section: ${stray.join(', ')}`)
  const atomsMap: Record<string, string> = {}
  const items: Lesson['items'] = []
  covered.forEach((label, i) => {
    const row = i + 1
    atomsMap[String(row)] = label
    for (const item of atoms.get(label)!.items) {
      const { src, ...rest } = item
      void src
      items.push({ row, set: 1, ...rest })
    }
  })
  return {
    topic: 'nf-fractions',
    source: 'Fractions_Atoms_Lessons.docx',
    atoms: atomsMap,
    narrative: 'land-before-counting.mp4',
    items,
  }
}

if (process.argv[1]?.endsWith('build-lesson.ts') === true) {
  const transcription = JSON.parse(readFileSync('content/transcription/fractions.transcription.json', 'utf8')) as {
    sections: { label: string }[]
  }
  const lesson = buildLesson(
    transcription.sections.map((s) => s.label),
    readAtomFiles(),
  )
  LessonFile.parse(lesson)
  writeFileSync('public/lessons/NF_Fractions.lesson.json', JSON.stringify(lesson, null, 2) + '\n')
  console.log(`rows: ${Object.keys(lesson.atoms ?? {}).length}, items: ${lesson.items.length}`)
}
