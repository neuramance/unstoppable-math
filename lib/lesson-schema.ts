import { z } from 'zod'
import { FIGURE_KINDS, FIGURE_ORIENTATIONS, FIGURE_UNIT_MARKS, MAX_PARTS, maxPartsFor, maxUnitsFor } from './figures'
import { fractionValue, gradeItem, normalizeAnswer, type LessonItem } from './lesson'

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
    scale: z.number().min(0.5).max(1).optional(),
  })
  .refine((f) => f.units <= maxUnitsFor(f.kind), 'too many units for this figure kind')
  .refine((f) => f.parts <= maxPartsFor(f.kind, f.units), 'too many parts for this figure kind')
  .refine((f) => (f.counted ?? 0) <= f.units * f.parts, 'shading exceeds the figure')
  .refine(
    (f) => f.columns === undefined || (f.kind === 'grid' && f.parts % f.columns === 0),
    'grid must have complete rows',
  )
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

const ItemFields = {
  role: z.enum(['model', 'test']),
  prompt: z.string().min(1),
  expected: z.string().min(1),
  demo: z.string().min(1),
  count: z.enum(['units', 'parts', 'counted']).optional(),
  figures: z.array(AtomFigure).min(1).max(2).optional(),
  expr: z.string().min(1).optional(),
  frac: FracSlots.optional(),
  accept: z.array(z.string().min(1)).min(1).optional(),
  numberLine: z
    .array(
      z
        .string()
        .regex(/^(?:\d+ )?\d+\/[1-9]\d*$/)
        .refine((text) => fractionValue(text) <= 10, 'fraction is outside the number line'),
    )
    .min(2)
    .max(5)
    .optional(),
}

const ConstructFigure = AtomFigure.safeExtend({
  kind: z.literal('bar'),
  units: z.literal(1),
  counted: z.number().int().min(0),
  label: z.string().min(1),
}).refine((figure) => figure.counted <= figure.parts, 'shading exceeds the whole unit')
const ConstructFields = { mode: z.literal('construct'), figures: z.tuple([ConstructFigure, ConstructFigure]) }
const ShadeFractionFields = {
  mode: z.literal('shade-fraction'),
  figures: z.tuple([AtomFigure.safeExtend({ counted: z.number().int().min(0) })]),
  expr: z.string().min(1),
}
const ChoiceFields = { mode: z.literal('choice'), choices: z.array(z.string().min(1)).min(2).max(4) }
const FractionFields = { mode: z.literal('frac'), frac: FracSlots, match: z.literal('value').optional() }
const DecomposeFields = { mode: z.literal('decompose'), expr: z.string().regex(/^[1-9]\d*\/[1-9]\d*$/) }
const LineFractionFields = {
  mode: z.literal('line-fractions'),
  figures: z.tuple([AtomFigure.safeExtend({ kind: z.literal('number-line') })]),
  blank: z.enum(['numerator', 'denominator']),
}
const src = z.string().regex(/^(II|IT|EX|TBL|NOTE):[1-9]\d*(?:-[1-9]\d*)?[a-z]?$/)
function validAnswer(item: LessonItem): boolean {
  if (item.match === 'value')
    return item.frac?.num === null && item.frac.den === null && /^\d+\/[1-9]\d*$/.test(item.expected)
  if (item.mode === 'choice')
    return (
      item.accept === undefined &&
      new Set(item.choices.map(normalizeAnswer)).size === item.choices.length &&
      item.choices.includes(item.expected)
    )
  if (item.mode === 'decompose')
    return [2, 3].includes(item.expected.split(';').length) && gradeItem(item, item.expected)
  if (item.mode === 'construct') {
    const [a, b] = item.figures
    const equal = a.counted * b.parts === b.counted * a.parts
    return item.expected === `${a.parts} ${a.counted} ${b.parts} ${b.counted} ${equal ? 'yes' : 'no'}`
  }
  if (item.mode === 'shade-fraction') {
    const f = item.figures[0]
    return f.units === 1 && item.expected === `${f.counted} ${f.counted}`
  }
  if (item.mode === 'line-fractions') {
    const f = item.figures[0]
    return (
      item.expected ===
      Array.from({ length: f.units + 1 }, (_, u) => (item.blank === 'numerator' ? u * f.parts : f.parts)).join(' ')
    )
  }
  if (item.mode === 'shade') {
    const counts = item.expected.split(/[\s,]+/).map(Number)
    return (
      item.figures !== undefined &&
      counts.length === item.figures.length &&
      item.figures.every((f, i) => Number.isInteger(counts[i]) && counts[i] > 0 && counts[i] <= f.units * f.parts)
    )
  }
  return true
}
const AuthoredItem = z
  .discriminatedUnion('mode', [
    z.strictObject({ ...ItemFields, src, mode: z.enum(['typed', 'shade']) }),
    z.strictObject({ ...ItemFields, src, ...FractionFields }),
    z.strictObject({ ...ItemFields, src, ...ConstructFields }),
    z.strictObject({ ...ItemFields, src, ...ShadeFractionFields }),
    z.strictObject({ ...ItemFields, src, ...ChoiceFields }),
    z.strictObject({ ...ItemFields, src, ...DecomposeFields }),
    z.strictObject({ ...ItemFields, src, ...LineFractionFields }),
  ])
  .refine((item) => validAnswer({ row: 1, ...item }), 'answer does not match its interaction')

export const AtomFile = z.strictObject({
  label: z.string().regex(/^\d+[a-z]?$/),
  items: z.array(AuthoredItem).min(1),
})

export type AtomFileT = z.infer<typeof AtomFile>

const PositionFields = {
  row: z.number().int().min(1),
  set: z.number().int().min(1).default(1),
}
const LessonItemSchema = z
  .discriminatedUnion('mode', [
    z.strictObject({ ...ItemFields, ...PositionFields, mode: z.enum(['typed', 'shade']) }),
    z.strictObject({ ...ItemFields, ...PositionFields, ...FractionFields }),
    z.strictObject({ ...ItemFields, ...PositionFields, ...ConstructFields }),
    z.strictObject({ ...ItemFields, ...PositionFields, ...ShadeFractionFields }),
    z.strictObject({ ...ItemFields, ...PositionFields, ...ChoiceFields }),
    z.strictObject({ ...ItemFields, ...PositionFields, ...DecomposeFields }),
    z.strictObject({ ...ItemFields, ...PositionFields, ...LineFractionFields }),
  ])
  .refine(validAnswer, 'answer does not match its interaction')

export const LessonData = z.strictObject({
  topic: z.string().min(1),
  source: z.string().min(1),
  atoms: z.record(z.string(), z.string()).optional(),
  narrative: z.string().min(1).optional(),
  items: z.array(LessonItemSchema).min(1),
})

export const LessonFile = LessonData.safeExtend({
  topic: z.literal('nf-fractions'),
  source: z.literal('Fractions_Atoms_Lessons.docx'),
  atoms: z.record(z.string(), z.string()),
  narrative: z.literal('land-before-counting.mp4'),
})
