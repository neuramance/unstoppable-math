import { expect, test } from 'vitest'
import {
  FIGURE_KINDS,
  FIGURE_ORIENTATIONS,
  FIGW,
  MAX_PARTS,
  PAD,
  badgeCount,
  barSpanUnits,
  barUnitStart,
  barUnitWidth,
  cellRun,
  cellStart,
  gridColumns,
  gridRows,
  maxPartsFor,
  maxUnitsFor,
  morphs,
  orientationOf,
  partEdges,
  partOffset,
  partShare,
  partsAreEqual,
  pickStep,
  polygonRadius,
  polygonSides,
  polygonTilt,
  representationOf,
  sectorAngle,
  shadeable,
  spansMajorArc,
  takesColumns,
  takesOrientation,
  takesUnitMarks,
  turnsOnly,
  unevenTotal,
  unevenWeight,
  unitMarkFractions,
  unitMarkNumerator,
  unitMarkRoom,
  unitMarkText,
  unitWidth,
} from './figures'
import type { Figure } from './figures'

test('orientation is a property of the strip kinds, never baked into a kind name', () => {
  for (const kind of FIGURE_KINDS) {
    for (const word of FIGURE_ORIENTATIONS) {
      expect({ kind, word, baked: kind.includes(word) }).toEqual({ kind, word, baked: false })
    }
  }
  expect(FIGURE_KINDS.filter(takesOrientation)).toEqual(['number-line', 'bar'])
  expect(orientationOf({ kind: 'bar', units: 1, parts: 1 })).toBe('horizontal')
  expect(orientationOf({ kind: 'bar', units: 1, parts: 1, orientation: 'vertical' })).toBe('vertical')
})

test('his four polygons are four shapes, each drawn with the side count his own word names', () => {
  expect(polygonSides('triangle', 1)).toBe(3)
  expect(polygonSides('square', 1)).toBe(4)
  expect(polygonSides('pentagon', 1)).toBe(5)
  expect(polygonSides('hexagon', 1)).toBe(6)
  expect(polygonSides('pentagon', 10)).toBe(5)
  expect(polygonSides('hexagon', 3)).toBe(6)
})

test('`polygon` keeps meaning a regular polygon whose sides are its parts, and a pentagon undivided', () => {
  expect(polygonSides('polygon', 5)).toBe(5)
  expect(polygonSides('polygon', 10)).toBe(10)
  expect(polygonSides('polygon', 3)).toBe(3)
  expect(polygonSides('polygon', 1)).toBe(5)
})

test('a square sits flat, because a square standing on its corner is a diamond', () => {
  expect(polygonTilt('square')).toBeCloseTo(Math.PI / 4, 12)
  for (const kind of FIGURE_KINDS) {
    if (kind === 'square') continue
    expect({ kind, tilt: polygonTilt(kind) }).toEqual({ kind, tilt: 0 })
  }
})

test('a shade answer is only ever asked of a figure a finger can land on', () => {
  expect<readonly string[]>(FIGURE_KINDS.filter(shadeable)).toEqual(['number-line', 'bar', 'grid'])
})

test('a strip and a round figure both hold five units, and a grid holds one', () => {
  for (const kind of FIGURE_KINDS) {
    expect({ kind, max: maxUnitsFor(kind) }).toEqual({ kind, max: takesColumns(kind) ? 1 : 5 })
  }
  expect([...new Set(FIGURE_KINDS.map(maxUnitsFor))].sort()).toEqual([1, 5])
})

const TURN = 2 * Math.PI
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

test('a wedge of a polygon reaches its edge and never crosses it', () => {
  for (const sides of [3, 4, 5, 6, 10]) {
    const inradius = Math.cos(Math.PI / sides)
    for (let step = 0; step < 720; step++) {
      const theta = (TURN * step) / 720
      const r = polygonRadius(sides, theta, 1)
      expect({ sides, step, inside: r >= inradius - 1e-9 && r <= 1 + 1e-9 }).toEqual({ sides, step, inside: true })
    }
    expect({ sides, corner: round6(polygonRadius(sides, -Math.PI / 2, 1)) }).toEqual({ sides, corner: 1 })
    const mid = polygonRadius(sides, -Math.PI / 2 + Math.PI / sides, 1)
    expect({ sides, edge: round6(mid) }).toEqual({ sides, edge: round6(inradius) })
  }
})

test('a circle has no corners: every ray reaches the same distance', () => {
  for (let step = 0; step < 360; step++) {
    expect(polygonRadius(0, (TURN * step) / 360, 80)).toBe(80)
  }
})

test('a sector angle starts a quarter turn early so offset zero points straight up, and only a run past half spans the major arc', () => {
  expect(sectorAngle(0)).toBeCloseTo(-Math.PI / 2, 12)
  expect(sectorAngle(0.25)).toBeCloseTo(0, 12)
  expect(sectorAngle(1)).toBeCloseTo((3 * Math.PI) / 2, 12)
  expect(spansMajorArc(0, 0.5)).toBe(false)
  expect(spansMajorArc(0, 0.500001)).toBe(true)
  expect(spansMajorArc(0.2, 0.6)).toBe(false)
})

const hisRow3: Figure = { kind: 'circle', units: 1, parts: 3, equal: false }
const theWrongPicture: Figure = { kind: 'circle', units: 1, parts: 3 }

test('his row 3 figure is sayable, and says the one thing his answer key turns on', () => {
  expect(partsAreEqual(hisRow3)).toBe(false)
  expect(partsAreEqual(theWrongPicture)).toBe(true)
  expect(partsAreEqual({ kind: 'bar', units: 2, parts: 5, counted: 7 })).toBe(true)
})

test('a figure that states its cuts is unequal too, whichever spelling it uses', () => {
  const bounded: Figure = { kind: 'circle', units: 1, parts: 2, bounds: [0.2] }
  expect(partsAreEqual(bounded)).toBe(false)
  expect(partsAreEqual({ kind: 'circle', units: 1, parts: 2, equal: false })).toBe(
    partsAreEqual({ kind: 'circle', units: 1, parts: 2, bounds: [0.2] }),
  )
  expect(partsAreEqual({ kind: 'circle', units: 1, parts: 2 })).toBe(true)
})

test('his three sectors come out three different sizes, and the equal control comes out three identical ones', () => {
  const shares = Array.from({ length: hisRow3.parts }, (_, i) => partShare(hisRow3, i))
  expect(new Set(shares).size).toBe(hisRow3.parts)
  expect(Math.max(...shares) / Math.min(...shares)).toBeCloseTo(2, 12)
  const flat = Array.from({ length: theWrongPicture.parts }, (_, i) => partShare(theWrongPicture, i))
  expect(new Set(flat).size).toBe(1)
  expect(Math.max(...flat) / Math.min(...flat)).toBe(1)
})

test('unequal parts still tile the unit exactly: no gap at the end and no overlap', () => {
  for (const fig of [hisRow3, theWrongPicture]) {
    expect(partOffset(fig, 0)).toBe(0)
    expect(partOffset(fig, fig.parts)).toBeCloseTo(1, 12)
    let running = 0
    for (let i = 0; i < fig.parts; i++) {
      expect({ i, start: partOffset(fig, i) }).toEqual({ i, start: running })
      running += partShare(fig, i)
    }
    expect(running).toBeCloseTo(1, 12)
  }
})

test('an equal offset is exactly the division it always was, not a cumulative sum that lands near it', () => {
  for (const parts of [1, 2, 3, 4, 5, 7, 10, 20]) {
    for (const kind of FIGURE_KINDS) {
      const fig: Figure = { kind, units: 2, parts }
      for (let i = 0; i <= parts; i++) expect({ parts, i, at: partOffset(fig, i) }).toEqual({ parts, i, at: i / parts })
      for (let i = 0; i < parts; i++) expect({ parts, i, of: partShare(fig, i) }).toEqual({ parts, i, of: 1 / parts })
    }
  }
})

test('the uneven layout is visibly uneven at every part count, not merely uneven on paper', () => {
  for (let parts = 2; parts <= 20; parts++) {
    const fig: Figure = { kind: 'circle', units: 1, parts, equal: false }
    const shares = Array.from({ length: parts }, (_, i) => partShare(fig, i))
    const min = Math.min(...shares)
    const max = Math.max(...shares)
    expect({ parts, ratio: Math.round((max / min) * 1e9) / 1e9 }).toEqual({ parts, ratio: 2 })
    expect({ parts, starved: min < 0.6 / parts }).toEqual({ parts, starved: false })
    expect({ parts, sums: Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-12 }).toEqual({ parts, sums: true })
    expect({ parts, allEqual: new Set(shares.map((s) => Math.round(s * 1e9))).size === 1 }).toEqual({
      parts,
      allEqual: false,
    })
  }
})

test('the uneven weights are one cycle of three, so the layout is a rule rather than a table of cases', () => {
  expect([0, 1, 2, 3, 4, 5].map(unevenWeight)).toEqual([4, 2, 3, 4, 2, 3])
  expect([1, 2, 3, 4, 5, 6].map(unevenTotal)).toEqual([4, 6, 9, 13, 15, 18])
  const fig: Figure = { kind: 'circle', units: 1, parts: 3, equal: false }
  expect([0, 1, 2, 3].map((i) => partOffset(fig, i))).toEqual([0, 4 / 9, 6 / 9, 1])
})

test('one part cannot be unequal to itself, so a single part fills its unit whatever it claims', () => {
  const lone: Figure = { kind: 'circle', units: 1, parts: 1, equal: false }
  expect(partShare(lone, 0)).toBe(1)
  expect(partOffset(lone, 1)).toBe(1)
})

test('whether the parts are the same size is a change of picture, not a change of number', () => {
  const equal: Figure = { kind: 'circle', units: 1, parts: 3 }
  expect(representationOf(equal)).not.toBe(representationOf({ ...equal, equal: false }))
  expect(representationOf({ ...equal, equal: true })).toBe(representationOf(equal))
  expect(representationOf({ ...equal, counted: 2 })).toBe(representationOf(equal))
})

test('turning a figure on its side is a change of representation, not a change of number', () => {
  const flat: Figure = { kind: 'bar', units: 2, parts: 5, counted: 7 }
  const upright: Figure = { ...flat, orientation: 'vertical' }
  expect(representationOf(flat)).not.toBe(representationOf(upright))
  expect(representationOf({ ...flat, kind: 'triangle' })).not.toBe(representationOf({ ...flat, kind: 'square' }))
  expect(representationOf({ ...flat, counted: 3 })).toBe(representationOf(flat))
})

test('partEdges is the equal division unless the cuts are stated, and stated cuts are clamped by the ends', () => {
  expect(partEdges(4)).toEqual([0, 0.25, 0.5, 0.75, 1])
  expect(partEdges(1)).toEqual([0, 1])
  expect(partEdges(2, [0.7])).toEqual([0, 0.7, 1])
  const bounded: Figure = { kind: 'bar', units: 1, parts: 2, bounds: [0.7] }
  expect(partOffset(bounded, 1)).toBe(0.7)
  expect(partShare(bounded, 0)).toBeCloseTo(0.7, 12)
  expect(partShare(bounded, 1)).toBeCloseTo(0.3, 12)
})

test('a badge names the count its kind asks for, and nothing when no count is asked', () => {
  const fig: Figure = { kind: 'bar', units: 2, parts: 5 }
  expect(badgeCount('units', fig, 7)).toBe(2)
  expect(badgeCount('parts', fig, 7)).toBe(5)
  expect(badgeCount('counted', fig, 7)).toBe(7)
  expect(badgeCount(undefined, fig, 7)).toBe(0)
})

test('cellStart walks a strip cell by cell across whole units, at the unit width the span divides into', () => {
  const uw = unitWidth(2, FIGW)
  expect(uw).toBe((FIGW - 2 * PAD) / 2)
  const fig: Figure = { kind: 'number-line', units: 2, parts: 3 }
  expect(cellStart(fig, 0, uw)).toBe(PAD)
  expect(cellStart(fig, 1, uw)).toBeCloseTo(PAD + uw / 3, 9)
  expect(cellStart(fig, 3, uw)).toBeCloseTo(PAD + uw, 9)
  expect(cellStart(fig, 5, uw)).toBeCloseTo(PAD + uw + (2 * uw) / 3, 9)
})

const round9 = (n: number) => Math.round(n * 1e9) / 1e9

test('a bar puts one gap between whole units and never inside one, and the units plus gaps fill the strip', () => {
  expect(barSpanUnits(1)).toBe(1)
  expect(barUnitWidth(1, FIGW)).toBe(FIGW - 2 * PAD)
  for (let units = 2; units <= maxUnitsFor('bar'); units++) {
    for (const parts of [1, 2, 5, maxPartsFor('bar', units)]) {
      const fig: Figure = { kind: 'bar', units, parts }
      const at = `${units} units of ${parts}`
      const uw = barUnitWidth(units, FIGW)
      const starts = Array.from({ length: units }, (_, u) => barUnitStart(u, uw))
      const gaps = starts.slice(1).map((s, u) => round9(s - (starts[u] + uw)))
      expect({ at, gaps: new Set(gaps).size, positive: gaps.every((gap) => gap > 0) }).toEqual({
        at,
        gaps: 1,
        positive: true,
      })
      expect({ at, filled: round9(starts[units - 1] + uw) }).toEqual({ at, filled: FIGW - PAD })
      const runs = Array.from({ length: units * parts }, (_, k) => cellRun(fig, k, uw))
      expect({ at, spread: Math.max(...runs) - Math.min(...runs) < 1e-9 }).toEqual({ at, spread: true })
      expect({ at, tiled: round9(runs[0] * parts) }).toEqual({ at, tiled: round9(uw) })
    }
  }
})

test('the shade keyboard reaches every count in the range and clamps at both ends', () => {
  const OTHER_KEYS = [
    'Enter',
    ' ',
    'Escape',
    'Tab',
    'Backspace',
    'Delete',
    'PageUp',
    'PageDown',
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'F1',
    'a',
    'z',
    'A',
    '0',
    '9',
    '/',
    'Dead',
    'Process',
    'Unidentified',
    'arrowright',
    'ARROWLEFT',
    'constructor',
    '__proto__',
    'toString',
    'valueOf',
    'hasOwnProperty',
  ]
  for (let total = 1; total <= 20; total++) {
    for (let counted = 0; counted <= total; counted++) {
      const at = `total ${total} counted ${counted}`
      for (const key of ['ArrowRight', 'ArrowUp']) {
        expect({ at, key, to: pickStep(key, counted, total) }).toEqual({ at, key, to: Math.min(total, counted + 1) })
      }
      for (const key of ['ArrowLeft', 'ArrowDown']) {
        expect({ at, key, to: pickStep(key, counted, total) }).toEqual({ at, key, to: Math.max(0, counted - 1) })
      }
      expect({ at, to: pickStep('Home', counted, total) }).toEqual({ at, to: 0 })
      expect({ at, to: pickStep('End', counted, total) }).toEqual({ at, to: total })
      for (const key of OTHER_KEYS) {
        expect({ at, key, to: pickStep(key, counted, total) }).toEqual({ at, key, to: null })
      }
    }
  }
})

test('walking one key at a time visits every count a shade item can ask for', () => {
  for (let total = 1; total <= 20; total++) {
    const seen = new Set<number>()
    let at = 0
    seen.add(at)
    for (let step = 0; step < total + 3; step++) {
      at = pickStep('ArrowRight', at, total)!
      seen.add(at)
    }
    expect({ total, visited: seen.size }).toEqual({ total, visited: total + 1 })
    for (let step = 0; step < total + 3; step++) at = pickStep('ArrowLeft', at, total)!
    expect({ total, floor: at }).toEqual({ total, floor: 0 })
  }
})

test('a five unit strip carries no more cells than the three unit strip already carried', () => {
  expect([1, 2, 3, 4, 5].map((units) => maxPartsFor('number-line', units))).toEqual([20, 20, 20, 15, 12])
  expect([1, 2, 3, 4, 5].map((units) => maxPartsFor('bar', units))).toEqual([20, 20, 20, 15, 12])
  expect([1, 2, 3, 4, 5].map((units) => units * maxPartsFor('bar', units))).toEqual([20, 40, 60, 60, 60])
  for (const kind of FIGURE_KINDS) {
    for (let units = 1; units <= 3; units += 1) {
      expect({ kind, units, parts: maxPartsFor(kind, units) }).toEqual({ kind, units, parts: MAX_PARTS })
    }
  }
  expect(maxPartsFor('circle', 5)).toBe(MAX_PARTS)
  expect(maxPartsFor('pentagon', 4)).toBe(MAX_PARTS)
})

const hisGrid: Figure = { kind: 'grid', units: 1, parts: 20, columns: 5, counted: 8 }
const hisBlankGrid: Figure = { kind: 'grid', units: 1, parts: 20, columns: 5 }
const unsaidGrid: Figure = { kind: 'grid', units: 1, parts: 20 }
const fourWideGrid: Figure = { kind: 'grid', units: 1, parts: 20, columns: 4 }

test('a lattice is a kind of its own, because a partition in two directions is not a strip of cells', () => {
  expect<readonly string[]>(FIGURE_KINDS).toEqual([
    'number-line',
    'bar',
    'polygon',
    'triangle',
    'square',
    'pentagon',
    'hexagon',
    'circle',
    'grid',
  ])
  expect<number>(FIGURE_KINDS.length).toBe(9)
})

test('a lattice is shadeable without being orientable, which is the case that splits the two predicates', () => {
  expect<readonly string[]>(FIGURE_KINDS.filter(shadeable)).toEqual(['number-line', 'bar', 'grid'])
  expect(FIGURE_KINDS.filter(takesOrientation)).toEqual(['number-line', 'bar'])
  expect<readonly string[]>(FIGURE_KINDS.filter(takesColumns)).toEqual(['grid'])
})

test('his lattice is five across and four down, and the second number is derived rather than stored twice', () => {
  expect(gridColumns(hisGrid)).toBe(5)
  expect(gridRows(hisGrid.parts, gridColumns(hisGrid))).toBe(4)
  expect(gridRows(20, 4)).toBe(5)
  expect(gridRows(1, 1)).toBe(1)
  expect(gridColumns(unsaidGrid)).toBe(20)
  expect(gridRows(20, gridColumns(unsaidGrid))).toBe(1)
})

test('how wide a lattice runs is a change of picture, not a change of number', () => {
  expect(representationOf(hisBlankGrid)).not.toBe(representationOf(fourWideGrid))
  expect(representationOf(hisBlankGrid)).toBe(representationOf(hisGrid))
  expect(representationOf({ kind: 'bar', units: 1, parts: 4 })).toBe(
    representationOf({ kind: 'bar', units: 1, parts: 8 }),
  )
})

const hisBlankMarks: Figure = {
  kind: 'number-line',
  units: 5,
  parts: 5,
  unitMarks: 'blank-fractions',
  orientation: 'horizontal',
}
const hisFilledMarks: Figure = {
  kind: 'number-line',
  units: 5,
  parts: 5,
  unitMarks: 'fractions',
  orientation: 'horizontal',
}

test('his row 41 stands six fractions over his six unit marks, and every one of them is his', () => {
  expect(unitMarkFractions(hisFilledMarks)).toEqual(['0/5', '5/5', '10/5', '15/5', '20/5', '25/5'])
  expect(unitMarkFractions(hisBlankMarks)).toEqual(unitMarkFractions(hisFilledMarks))
  expect(unitMarkNumerator(3, 5)).toBe(15)
  expect(unitMarkNumerator(0, 5)).toBe(0)
})

test('a line in thirds carries thirds, so nothing about the six is written into the renderer', () => {
  expect(unitMarkFractions({ kind: 'number-line', units: 5, parts: 3 })).toEqual([
    '0/3',
    '3/3',
    '6/3',
    '9/3',
    '12/3',
    '15/3',
  ])
  expect(unitMarkFractions({ kind: 'number-line', units: 2, parts: 4 })).toEqual(['0/4', '4/4', '8/4'])
})

test('what stands over a mark is his box until he fills it, and his own glyph is the box', () => {
  expect(hisFilledMarks.units + 1).toBe(6)
  expect(Array.from({ length: 6 }, (_, m) => unitMarkText(hisBlankMarks, m))).toEqual([
    '▢/5',
    '▢/5',
    '▢/5',
    '▢/5',
    '▢/5',
    '▢/5',
  ])
  expect(Array.from({ length: 6 }, (_, m) => unitMarkText(hisFilledMarks, m))).toEqual([
    '0/5',
    '5/5',
    '10/5',
    '15/5',
    '20/5',
    '25/5',
  ])
  expect(unitMarkRoom({ kind: 'number-line', units: 5, parts: 5 })).toBe(0)
  expect(unitMarkRoom(hisBlankMarks)).toBeGreaterThan(0)
})

test('only a line takes marks, because a mark is a position on an axis', () => {
  expect(FIGURE_KINDS.filter(takesUnitMarks)).toEqual(['number-line'])
})

test('a fraction over every mark is a change of picture, not a change of number', () => {
  const bare: Figure = { kind: 'number-line', units: 5, parts: 5 }
  expect(representationOf(bare)).not.toBe(representationOf(hisBlankMarks))
  expect(representationOf(hisBlankMarks)).not.toBe(representationOf(hisFilledMarks))
  expect(representationOf(bare)).toBe('number-line:horizontal:equal')
})

test('a step is a continuous conversion only when one figure re-subdivides: same picture, other parts', () => {
  const line = (parts: number): Figure => ({ kind: 'number-line', units: 3, parts })
  expect(morphs([line(4)], [line(7)])).toBe(true)
  expect(morphs([line(7)], [line(4)])).toBe(true)
  expect(morphs([line(4)], [line(4)])).toBe(false)
  expect(morphs([line(4)], [{ kind: 'bar', units: 3, parts: 7 }])).toBe(false)
  expect(morphs([line(4)], [{ ...line(7), units: 2 }])).toBe(false)
  expect(morphs([line(4)], [{ ...line(7), orientation: 'vertical' }])).toBe(false)
  expect(morphs([line(4)], [{ ...line(7), equal: false }])).toBe(false)
  expect(morphs([{ ...line(4), bounds: [0.5] }], [line(7)])).toBe(false)
  expect(morphs([line(4)], [{ ...line(7), counted: 2 }])).toBe(false)
  expect(morphs([line(4)], [{ ...line(7), band: true }])).toBe(false)
  expect(morphs([line(4)], [{ ...line(7), unitMarks: 'fractions' }])).toBe(false)
  expect(morphs([line(4)], [{ ...line(7), label: 'x' }])).toBe(false)
  expect(morphs([line(4), line(7)], [line(7)])).toBe(false)
  expect(morphs([line(4)], [line(7), line(3)])).toBe(false)
  expect(morphs(undefined, [line(7)])).toBe(false)
  expect(morphs([line(4)], undefined)).toBe(false)
  expect(morphs([], [])).toBe(false)
})

test('a step turns only when the same single figure changes nothing but its orientation', () => {
  const flat: Figure = { kind: 'number-line', units: 2, parts: 3 }
  const upright: Figure = { ...flat, orientation: 'vertical' }
  expect(turnsOnly([flat], [upright])).toBe(true)
  expect(turnsOnly([upright], [flat])).toBe(true)
  expect(turnsOnly([flat], [flat])).toBe(false)
  expect(turnsOnly([flat], [{ ...upright, parts: 4 }])).toBe(false)
  expect(turnsOnly([flat], [{ ...upright, units: 3 }])).toBe(false)
  expect(turnsOnly([flat], [{ ...upright, kind: 'bar' }])).toBe(false)
  expect(turnsOnly([flat], [{ ...upright, bounds: [0.5] }])).toBe(false)
  expect(turnsOnly([flat, flat], [upright])).toBe(false)
  expect(turnsOnly(undefined, [upright])).toBe(false)
  expect(
    turnsOnly(
      [{ kind: 'circle', units: 1, parts: 3 }],
      [{ kind: 'circle', units: 1, parts: 3, orientation: 'vertical' }],
    ),
  ).toBe(false)
  expect(morphs([flat], [upright])).toBe(false)
})
