import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { XMLParser } from 'fast-xml-parser'

const DOCX = 'content/source/Fractions_Atoms_Lessons.docx'
const OUT = 'content/transcription/fractions.transcription.json'

function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const files = new Map<string, Buffer>()
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory')
    const method = buf.readUInt16LE(off + 10)
    const csize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const dataStart = localOff + 30 + lNameLen + lExtraLen
    const data = buf.subarray(dataStart, dataStart + csize)
    files.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data))
    off += 46 + nameLen + extraLen + commentLen
  }
  return files
}

type Node = Record<string, unknown>

function kids(node: Node): { tag: string; node: Node }[] {
  const tag = Object.keys(node).find((k) => k !== ':@' && k !== '#text')
  if (tag === undefined) return []
  const arr = node[tag]
  if (!Array.isArray(arr)) return []
  return arr.flatMap((c) => {
    const t = Object.keys(c as Node).find((k) => k !== ':@')
    return t === undefined ? [] : [{ tag: t, node: c as Node }]
  })
}

function attr(node: Node, name: string): string | undefined {
  const a = node[':@'] as Record<string, string> | undefined
  return a?.[`@_${name}`]
}

function rawText(node: Node): string {
  const arr = node[Object.keys(node).find((k) => k !== ':@') ?? '']
  if (!Array.isArray(arr)) return ''
  return arr.map((c) => String((c as Node)['#text'] ?? '')).join('')
}

const BARE = /^(?:[0-9]+|[▢]|⟦[^⟧]*⟧|[A-Za-z])$/

function fracPart(s: string): string {
  const p = s.trim()
  return BARE.test(p) ? p : `(${p})`
}

type Piece = { kind: 'text' | 'unit'; text: string }

function mathPieces(node: Node): Piece[] {
  const out: Piece[] = []
  for (const { tag, node: c } of kids(node)) {
    if (tag === 'm:r') out.push({ kind: 'text', text: mathRunText(c) })
    else if (tag === 'm:f') {
      const num = mathText(findChild(c, 'm:num'))
      const den = mathText(findChild(c, 'm:den'))
      out.push({ kind: 'unit', text: `${fracPart(num)}/${fracPart(den)}` })
    } else if (tag === 'm:borderBox') {
      const inner = mathText(findChild(c, 'm:e'))
      out.push({ kind: 'unit', text: inner.trim() === '' ? '▢' : `⟦${inner}⟧` })
    } else if (tag === 'm:d') {
      out.push({ kind: 'unit', text: `(${mathText(findChild(c, 'm:e'))})` })
    } else if (tag === 'm:m') {
      const rows = kids(c)
        .filter((k) => k.tag === 'm:mr')
        .map((k) =>
          kids(k.node)
            .filter((e) => e.tag === 'm:e')
            .map((e) => mathText(e.node))
            .join(' ')
            .trim(),
        )
      out.push({ kind: 'unit', text: `[stack ${rows.join(' | ')}]` })
    } else if (tag === 'm:acc') {
      out.push({ kind: 'unit', text: `[bar ${mathText(findChild(c, 'm:e'))}]` })
    } else if (tag === 'm:rad') {
      const deg = mathText(findChild(c, 'm:deg'))
      const index = deg === '' ? '' : `^${deg}`
      out.push({ kind: 'unit', text: `[rad${index} ${mathText(findChild(c, 'm:e'))}]` })
    } else if (tag === 'm:e' || tag === 'm:num' || tag === 'm:den' || tag === 'm:oMath') {
      out.push(...mathPieces(c))
    }
  }
  return out
}

function findChild(node: Node, tag: string): Node {
  const hit = kids(node).find((k) => k.tag === tag)
  return hit?.node ?? {}
}

function mathRunText(run: Node): string {
  return kids(run)
    .filter((k) => k.tag === 'm:t')
    .map((k) => rawText(k.node))
    .join('')
}

function joinPieces(pieces: Piece[]): string {
  let s = ''
  let prev: Piece | undefined
  for (const p of pieces) {
    if (p.text === '') continue
    if (prev !== undefined) {
      const a = s.at(-1) ?? ''
      const b = p.text[0] ?? ''
      const boundary = prev.kind === 'unit' || p.kind === 'unit'
      if (boundary && /[0-9A-Za-z▢⟧)\]]/.test(a) && /[0-9A-Za-z▢⟦([]/.test(b)) s += ' '
    }
    s += p.text
    prev = p
  }
  return s.replace(/\s*([=×÷+±<>≤≥])\s*/g, ' $1 ').replace(/ {2,}/g, ' ')
}

function mathText(node: Node): string {
  return joinPieces(mathPieces(node))
}

function runPiece(rt: string, rc: Node, images: Map<string, string>): Piece | undefined {
  if (rt === 'w:t') return { kind: 'text', text: rawText(rc) }
  if (rt === 'w:br') return { kind: 'text', text: '\n' }
  if (rt === 'w:tab') return { kind: 'text', text: ' ' }
  if (rt === 'w:noBreakHyphen') return { kind: 'text', text: '-' }
  if (rt === 'w:drawing') {
    const blip = findDescendant(rc, 'a:blip')
    const rid = blip === undefined ? undefined : attr(blip, 'r:embed')
    const file = rid === undefined ? undefined : images.get(rid)
    if (file !== undefined) return { kind: 'unit', text: `[image:${file}]` }
  }
  return undefined
}

function paraText(p: Node, images: Map<string, string>): string {
  const pieces: Piece[] = []
  const walk = (node: Node): void => {
    for (const { tag, node: c } of kids(node)) {
      if (tag === 'w:r') {
        for (const { tag: rt, node: rc } of kids(c)) {
          const piece = runPiece(rt, rc, images)
          if (piece !== undefined) pieces.push(piece)
        }
      } else if (tag === 'm:oMath') pieces.push({ kind: 'unit', text: mathText(c) })
      else if (tag === 'm:oMathPara') {
        for (const om of kids(c).filter((k) => k.tag === 'm:oMath'))
          pieces.push({ kind: 'unit', text: mathText(om.node) })
      } else if (tag === 'w:hyperlink' || tag === 'w:smartTag') walk(c)
    }
  }
  walk(p)
  return joinPieces(pieces)
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim()
}

function findDescendant(node: Node, tag: string): Node | undefined {
  for (const { tag: t, node: c } of kids(node)) {
    if (t === tag) return c
    const hit = findDescendant(c, tag)
    if (hit !== undefined) return hit
  }
  return undefined
}

function headingLevel(p: Node): number {
  const pPr = findChild(p, 'w:pPr')
  const style = kids(pPr).find((k) => k.tag === 'w:pStyle')
  const val = style === undefined ? undefined : attr(style.node, 'w:val')
  const m = val === undefined ? null : /^Heading([1-9])$/.exec(val)
  return m === null ? 0 : Number(m[1])
}

type TableRow = { label: string; standards: string; prompt: string; response: string; type: string; notes: string }

function tableRows(tbl: Node, images: Map<string, string>): TableRow[] {
  const rows: TableRow[] = []
  for (const { tag, node: tr } of kids(tbl)) {
    if (tag !== 'w:tr') continue
    const cells = kids(tr)
      .filter((k) => k.tag === 'w:tc')
      .map((k) =>
        kids(k.node)
          .filter((c) => c.tag === 'w:p')
          .map((c) => paraText(c.node, images))
          .filter((s) => s !== ''),
      )
    if (cells.length < 5) continue
    const [first = [], prompt = [], response = [], type = [], notes = []] = cells
    rows.push({
      label: first[0] ?? '',
      standards: first.slice(1).join(' '),
      prompt: prompt.join('\n'),
      response: response.join('\n'),
      type: type.join('\n'),
      notes: notes.join('\n'),
    })
  }
  return rows
}

type Section = {
  label: string
  heading: string
  table?: TableRow
  notes: string[]
  blocks: { II: string[]; IT: string[]; EX: string[] }
}

export type Transcription = {
  source: { file: string; sha256: string }
  atomisation: TableRow[]
  headaches: { title: string; lines: string[] }[]
  preamble: string[]
  sections: Section[]
}

function imageRels(relsDoc: Node[]): Map<string, string> {
  const images = new Map<string, string>()
  const walkRels = (nodes: Node[]): void => {
    for (const n of nodes) {
      const tag = Object.keys(n).find((k) => k !== ':@')
      if (tag === 'Relationship') {
        const id = attr(n, 'Id')
        const target = attr(n, 'Target')
        if (id !== undefined && target !== undefined && target.startsWith('media/'))
          images.set(id, target.slice('media/'.length))
      }
      if (tag !== undefined && Array.isArray(n[tag])) walkRels(n[tag] as Node[])
    }
  }
  walkRels(relsDoc)
  return images
}

type Zone = 'atomisation' | 'headache' | 'instruction' | 'start'

type Body = Omit<Transcription, 'source'>

function parseBody(body: Node, images: Map<string, string>): Body {
  const out: Body = { atomisation: [], headaches: [], preamble: [], sections: [] }
  let zone: Zone = 'start'
  let section: Section | undefined
  let block: 'II' | 'IT' | 'EX' | undefined

  const startSection = (heading: string): void => {
    const m = /^([0-9]+[a-z]*)\b/.exec(heading)
    section = {
      label: m?.[1] ?? heading,
      heading,
      notes: [],
      blocks: { II: [], IT: [], EX: [] },
    }
    block = undefined
    out.sections.push(section)
  }

  const heading1 = (text: string): Zone => {
    if (text === 'Fractions') return 'atomisation'
    if (text.startsWith('Headache')) {
      out.headaches.push({ title: text, lines: [] })
      return 'headache'
    }
    return text === 'Initial Instruction' ? 'instruction' : zone
  }

  const body2 = (text: string): void => {
    if (zone === 'headache') out.headaches.at(-1)?.lines.push(text)
    else if (zone === 'instruction') {
      if (section === undefined) out.preamble.push(text)
      else if (block === undefined) section.notes.push(text)
      else section.blocks[block].push(text)
    }
  }

  for (const { tag, node } of kids(body)) {
    if (tag === 'w:tbl') {
      if (zone === 'atomisation') out.atomisation.push(...tableRows(node, images).slice(1))
      else if (zone === 'instruction' && section !== undefined && section.table === undefined)
        section.table = tableRows(node, images)[0]
      continue
    }
    if (tag !== 'w:p') continue
    const level = headingLevel(node)
    const text = paraText(node, images)
    if (level === 1) zone = heading1(text)
    else if (zone === 'instruction' && level >= 2) {
      const label = text.trim()
      if (label === 'II' || label === 'IT' || label === 'EX') block = label
      else if (label !== '') startSection(label)
    } else if (level < 2 && text !== '') body2(text)
  }
  return out
}

export function extract(bytes: Buffer): Transcription {
  const files = unzip(bytes)
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    trimValues: false,
    parseTagValue: false,
  })
  const relsXml = files.get('word/_rels/document.xml.rels')
  const docXml = files.get('word/document.xml')
  if (relsXml === undefined || docXml === undefined) throw new Error('docx missing document parts')
  const images = imageRels(parser.parse(relsXml.toString('utf8')) as Node[])
  const doc = parser.parse(docXml.toString('utf8')) as Node[]
  const docEl = doc.find((n) => Object.keys(n).includes('w:document'))
  if (docEl === undefined) throw new Error('no w:document')
  const bodyEl = kids(docEl).find((k) => k.tag === 'w:body')
  if (bodyEl === undefined) throw new Error('no w:body')
  return {
    source: { file: 'Fractions_Atoms_Lessons.docx', sha256: createHash('sha256').update(bytes).digest('hex') },
    ...parseBody(bodyEl.node, images),
  }
}

if (process.argv[1]?.endsWith('extract-docx.ts') === true) {
  const out = extract(readFileSync(DOCX))
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  const blockCount = (k: 'II' | 'IT' | 'EX') => out.sections.filter((s) => s.blocks[k].length > 0).length
  console.log(
    `atomisation rows: ${out.atomisation.length}, headaches: ${out.headaches.length}, sections: ${out.sections.length}, II: ${blockCount('II')}, IT: ${blockCount('IT')}, EX: ${blockCount('EX')}, preamble: ${out.preamble.length}`,
  )
}
