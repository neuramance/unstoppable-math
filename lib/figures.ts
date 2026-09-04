export const FIGURE_KINDS = [
  'number-line',
  'bar',
  'polygon',
  'triangle',
  'square',
  'pentagon',
  'hexagon',
  'circle',
  'grid',
] as const
export type FigureKind = (typeof FIGURE_KINDS)[number]
export const FIGURE_ORIENTATIONS = ['horizontal', 'vertical'] as const
export type Orientation = (typeof FIGURE_ORIENTATIONS)[number]
export const FIGURE_UNIT_MARKS = ['fractions', 'blank-fractions'] as const
export type UnitMarks = (typeof FIGURE_UNIT_MARKS)[number]
export type Figure = {
  kind: FigureKind
  units: number
  parts: number
  counted?: number
  label?: string
  orientation?: Orientation
  equal?: boolean
  columns?: number
  unitMarks?: UnitMarks
  band?: true
  bounds?: number[]
  scale?: number
}
export type CountKind = 'units' | 'parts' | 'counted'
const STRIP_KINDS: ReadonlySet<FigureKind> = new Set<FigureKind>(['number-line', 'bar'])
export function takesOrientation(kind: FigureKind): boolean {
  return STRIP_KINDS.has(kind)
}
export function takesColumns(kind: FigureKind): boolean {
  return kind === 'grid'
}
export function orientationOf(figure: Figure): Orientation {
  return figure.orientation ?? 'horizontal'
}
export function partsAreEqual(figure: Figure): boolean {
  if (figure.bounds !== undefined) return false
  return figure.equal ?? true
}
export function morphs(prev: readonly Figure[] | undefined, next: readonly Figure[] | undefined): boolean {
  if (prev?.length !== 1 || next?.length !== 1) return false
  const a = prev[0]
  const b = next[0]
  return (
    a.parts !== b.parts &&
    a.kind === b.kind &&
    a.units === b.units &&
    orientationOf(a) === orientationOf(b) &&
    partsAreEqual(a) &&
    partsAreEqual(b) &&
    a.counted === b.counted &&
    a.band === b.band &&
    a.unitMarks === b.unitMarks &&
    a.columns === b.columns &&
    a.label === b.label
  )
}
export function turnsOnly(prev: readonly Figure[] | undefined, next: readonly Figure[] | undefined): boolean {
  if (prev?.length !== 1 || next?.length !== 1) return false
  const a = prev[0]
  const b = next[0]
  return (
    takesOrientation(a.kind) &&
    orientationOf(a) !== orientationOf(b) &&
    a.kind === b.kind &&
    a.units === b.units &&
    a.parts === b.parts &&
    a.equal === b.equal &&
    String(a.bounds) === String(b.bounds) &&
    a.counted === b.counted &&
    a.band === b.band &&
    a.unitMarks === b.unitMarks &&
    a.columns === b.columns &&
    a.label === b.label
  )
}
const MAX_STRIP_UNITS = 10
const MAX_ROUND_UNITS = 5
const MAX_GRID_UNITS = 1
const MAX_STRIP_CELLS = 60
export const MAX_PARTS = 20
export function maxUnitsFor(kind: FigureKind): number {
  if (kind === 'grid') return MAX_GRID_UNITS
  return STRIP_KINDS.has(kind) ? MAX_STRIP_UNITS : MAX_ROUND_UNITS
}
export function maxPartsFor(kind: FigureKind, units: number): number {
  return STRIP_KINDS.has(kind) ? stripParts(units) : MAX_PARTS
}
export function stripParts(units: number): number {
  console.assert(Number.isInteger(units))
  console.assert(units >= 1)
  console.assert(units <= MAX_STRIP_UNITS)
  return Math.min(MAX_PARTS, Math.floor(MAX_STRIP_CELLS / units))
}
export function gridColumns(figure: Figure): number {
  return figure.columns ?? figure.parts
}
export function gridRows(parts: number, columns: number): number {
  console.assert(Number.isInteger(parts))
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  console.assert(Number.isInteger(columns))
  console.assert(columns >= 1)
  console.assert(columns <= MAX_PARTS)
  return Math.ceil(parts / columns)
}
export const UNIT_MARK_BLANK = '▢'
export function unitMarkNumerator(mark: number, parts: number): number {
  console.assert(Number.isInteger(mark))
  console.assert(mark >= 0)
  console.assert(mark <= MAX_STRIP_UNITS)
  console.assert(Number.isInteger(parts))
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  return mark * parts
}
export function unitMarkFraction(mark: number, parts: number): string {
  console.assert(Number.isInteger(mark))
  console.assert(mark >= 0)
  console.assert(mark <= MAX_STRIP_UNITS)
  console.assert(Number.isInteger(parts))
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  return `${unitMarkNumerator(mark, parts)}/${parts}`
}
export function unitMarkText(figure: Figure, mark: number): string {
  if (figure.unitMarks === 'blank-fractions') return `${UNIT_MARK_BLANK}/${figure.parts}`
  return unitMarkFraction(mark, figure.parts)
}
const UNEVEN_CYCLE_TOTAL = 9
export function unevenWeight(index: number): number {
  console.assert(Number.isInteger(index))
  console.assert(index >= 0)
  const place = index % 3
  if (place === 0) return 4
  if (place === 1) return 2
  return 3
}
export function unevenTotal(parts: number): number {
  console.assert(Number.isInteger(parts))
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  const place = (parts - 1) % 3
  const tail = place === 0 ? 4 : place === 1 ? 6 : UNEVEN_CYCLE_TOTAL
  return UNEVEN_CYCLE_TOTAL * Math.floor((parts - 1) / 3) + tail
}
export function unevenOffset(parts: number, index: number): number {
  console.assert(Number.isInteger(parts))
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  console.assert(Number.isInteger(index))
  console.assert(index >= 0)
  console.assert(index <= MAX_PARTS)
  if (index === 0) return 0
  return unevenTotal(index) / unevenTotal(parts)
}
export function unevenShare(parts: number, index: number): number {
  console.assert(Number.isInteger(parts))
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  console.assert(Number.isInteger(index))
  console.assert(index >= 0)
  console.assert(index <= 19)
  return unevenWeight(index) / unevenTotal(parts)
}
export function partOffset(figure: Figure, index: number): number {
  if (figure.bounds !== undefined) return partEdges(figure.parts, figure.bounds)[index] ?? 1
  return partsAreEqual(figure) ? index / figure.parts : unevenOffset(figure.parts, index)
}
export function partShare(figure: Figure, index: number): number {
  if (figure.bounds !== undefined) {
    const edges = partEdges(figure.parts, figure.bounds)
    return (edges[index + 1] ?? 1) - (edges[index] ?? 1)
  }
  return partsAreEqual(figure) ? 1 / figure.parts : unevenShare(figure.parts, index)
}
export function columnOffset(figure: Figure, column: number, columns: number): number {
  console.assert(Number.isInteger(columns))
  console.assert(columns >= 1)
  console.assert(columns <= MAX_PARTS)
  return partsAreEqual(figure) ? column / columns : unevenOffset(columns, column)
}
export function columnShare(figure: Figure, column: number, columns: number): number {
  console.assert(Number.isInteger(columns))
  console.assert(columns >= 1)
  console.assert(columns <= MAX_PARTS)
  return partsAreEqual(figure) ? 1 / columns : unevenShare(columns, column)
}
export function gridColumnOf(index: number, rows: number): number {
  console.assert(Number.isInteger(index))
  console.assert(index >= 0)
  console.assert(index <= 19)
  console.assert(Number.isInteger(rows))
  console.assert(rows >= 1)
  console.assert(rows <= MAX_PARTS)
  return Math.floor(index / rows)
}
export function gridRowOf(index: number, rows: number): number {
  console.assert(Number.isInteger(index))
  console.assert(index >= 0)
  console.assert(index <= 19)
  console.assert(Number.isInteger(rows))
  console.assert(rows >= 1)
  console.assert(rows <= MAX_PARTS)
  return index % rows
}
export const PAD = 10
export const FIGW = 480
export const FIGV = 300
export const BAR_ACROSS = 56
export const LINE_ACROSS = 68
export const R = 80
export const GRID_DOWN = 384
export const UNIT_MARK_ROOM = 34
export const UNIT_MARK_BAR = 17
export const UNIT_MARK_RISE = 5
export const UNIT_MARK_DROP = 13
export const UNIT_MARK_BAR_HALF = 10
export const LINE_END_ROOM = 4
export function unitMarkRoom(figure: Figure): number {
  return figure.unitMarks === undefined ? 0 : UNIT_MARK_ROOM
}
export function longSpan(vertical: boolean) {
  const span = vertical ? FIGV : FIGW
  console.assert(span >= FIGV)
  console.assert(span <= FIGW)
  return span
}
export function rowHeight(rows: number) {
  console.assert(Number.isInteger(rows))
  console.assert(rows >= 1)
  console.assert(rows <= MAX_PARTS)
  return (GRID_DOWN - 2 * PAD) / rows
}
export function unitWidth(units: number, span: number) {
  console.assert(units >= 1)
  console.assert(units <= MAX_STRIP_UNITS)
  console.assert(span >= FIGV)
  console.assert(span <= FIGW)
  return (span - 2 * PAD) / units
}
export function cellWidth(units: number, parts: number, span: number) {
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  return unitWidth(units, span) / parts
}
export function partEdges(parts: number, bounds?: number[]): number[] {
  return bounds === undefined ? Array.from({ length: parts + 1 }, (_, i) => i / parts) : [0, ...bounds, 1]
}
export function cellStart(fig: Figure, k: number, uw: number) {
  return PAD + (Math.floor(k / fig.parts) + partOffset(fig, k % fig.parts)) * uw
}
const UNIT_GAP_SHARE = 24
export function barSpanUnits(units: number) {
  console.assert(Number.isInteger(units))
  console.assert(units >= 1)
  console.assert(units <= MAX_STRIP_UNITS)
  return units + (units - 1) / UNIT_GAP_SHARE
}
export function barUnitWidth(units: number, span: number) {
  console.assert(Number.isInteger(units))
  console.assert(units >= 1)
  console.assert(units <= MAX_STRIP_UNITS)
  console.assert(span >= FIGV)
  console.assert(span <= FIGW)
  return (span - 2 * PAD) / barSpanUnits(units)
}
export function barUnitStart(u: number, uw: number) {
  console.assert(Number.isInteger(u))
  console.assert(u >= 0)
  console.assert(u <= MAX_STRIP_UNITS)
  console.assert(uw > 0)
  console.assert(uw <= FIGW)
  return PAD + u * uw * (1 + 1 / UNIT_GAP_SHARE)
}
export function barCellStart(fig: Figure, k: number, uw: number) {
  return barUnitStart(Math.floor(k / fig.parts), uw) + partOffset(fig, k % fig.parts) * uw
}
export function cellRun(fig: Figure, k: number, uw: number) {
  return partShare(fig, k % fig.parts) * uw
}
export function badgeSize(slot: number) {
  console.assert(slot > 0)
  console.assert(slot <= 460)
  return Math.min(22, 0.6 * slot)
}
export function figX(along: number, across: number, span: number, vertical: boolean) {
  console.assert(along >= 0)
  console.assert(along <= FIGW)
  console.assert(across >= 0)
  console.assert(span >= FIGV)
  return vertical ? across : along
}
export function figY(along: number, across: number, span: number, vertical: boolean) {
  console.assert(along >= 0)
  console.assert(along <= FIGW)
  console.assert(across >= 0)
  return vertical ? span - along : across
}
export function rectY(along: number, across: number, alongLen: number, span: number, vertical: boolean) {
  console.assert(along >= 0)
  console.assert(alongLen > 0)
  console.assert(alongLen <= FIGW)
  return vertical ? span - along - alongLen : across
}
export function rectW(alongLen: number, acrossLen: number, vertical: boolean) {
  return vertical ? acrossLen : alongLen
}
export function rectH(alongLen: number, acrossLen: number, vertical: boolean) {
  return vertical ? alongLen : acrossLen
}
export function pickStep(key: string, counted: number, total: number): number | null {
  const to =
    key === 'Home'
      ? 0
      : key === 'End'
        ? total
        : key === 'ArrowRight' || key === 'ArrowUp'
          ? counted + 1
          : key === 'ArrowLeft' || key === 'ArrowDown'
            ? counted - 1
            : null
  return to === null ? null : Math.max(0, Math.min(total, to))
}
export function badgeCount(badge: CountKind | undefined, fig: Figure, counted: number) {
  if (badge === 'units') return fig.units
  if (badge === 'parts') return fig.parts
  if (badge === 'counted') return counted
  return 0
}
export function polygonSides(kind: FigureKind, parts: number): number {
  console.assert(parts >= 1)
  console.assert(parts <= MAX_PARTS)
  if (kind === 'triangle') return 3
  if (kind === 'square') return 4
  if (kind === 'pentagon') return 5
  if (kind === 'hexagon') return 6
  if (kind !== 'polygon') return 0
  return parts >= 3 ? parts : 5
}
const TURN = 2 * Math.PI
const QUARTER_TURN = Math.PI / 2
export function polygonTilt(kind: FigureKind): number {
  return kind === 'square' ? TURN / 8 : 0
}
export function polygonRadius(sides: number, theta: number, radius: number): number {
  if (sides < 3) return radius
  const step = TURN / sides
  const offset = theta + QUARTER_TURN - step / 2
  const psi = offset - step * Math.round(offset / step)
  return (radius * Math.cos(step / 2)) / Math.cos(psi)
}
export function sectorAngle(offset: number): number {
  console.assert(offset >= 0)
  console.assert(offset <= 1)
  return TURN * offset - QUARTER_TURN
}
export function partAngle(sides: number, tilt: number, offset: number): number {
  if (sides < 3) return sectorAngle(offset)
  const edge = Math.floor(offset * sides)
  const share = offset * sides - edge
  const a = (TURN * edge) / sides - QUARTER_TURN + tilt
  const b = a + TURN / sides
  const x = (1 - share) * Math.cos(a) + share * Math.cos(b)
  const y = (1 - share) * Math.sin(a) + share * Math.sin(b)
  const angle = Math.atan2(y, x)
  return angle + TURN * Math.round((a - angle) / TURN)
}
export function spansMajorArc(from: number, to: number): boolean {
  console.assert(from >= 0)
  console.assert(from <= 1)
  console.assert(to >= 0)
  console.assert(to <= 1)
  return to - from > 0.5
}
export function ringX(cx: number, r: number, angle: number) {
  return cx + r * Math.cos(angle)
}
export function ringY(cy: number, r: number, angle: number) {
  return cy + r * Math.sin(angle)
}
export function sectorX(cx: number, i: number, parts: number, r: number, tilt: number) {
  return ringX(cx, r, sectorAngle(i / parts) + tilt)
}
export function sectorY(cy: number, i: number, parts: number, r: number, tilt: number) {
  return ringY(cy, r, sectorAngle(i / parts) + tilt)
}
