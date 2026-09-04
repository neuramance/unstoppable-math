import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Lesson } from '../lib/lesson'
import { AtomFile, LessonFile, type AtomFileT } from '../lib/lesson-schema'

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
  const missing = sectionLabels.filter((l) => !atoms.has(l))
  if (missing.length > 0) throw new Error(`missing atom files: ${missing.join(', ')}`)
  const stray = [...atoms.keys()].filter((l) => !sectionLabels.includes(l))
  if (stray.length > 0) throw new Error(`atom files without a transcription section: ${stray.join(', ')}`)
  const atomsMap: Record<string, string> = {}
  const items: Lesson['items'] = []
  sectionLabels.forEach((label, i) => {
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
