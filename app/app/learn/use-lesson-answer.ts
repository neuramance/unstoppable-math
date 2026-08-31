import { useState } from 'react'
import type { LessonItem } from '@/lib/lesson'

export function useLessonAnswer(item: LessonItem | null, wrongTyped: string | null, reveal: boolean) {
  const [typed, setTyped] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [free, setFree] = useState('')
  const [sel, setSel] = useState<number[]>([])

  const figures = item?.figures ?? []
  const targets = item ? item.expected.split(/[\s/,]+/).map(Number) : []
  const fracSlots = item?.frac
    ? [...(item.frac.whole !== undefined ? [item.frac.whole] : []), item.frac.num, item.frac.den]
    : []
  const editable = fracSlots.filter((s) => s === null).length
  const filled = Array.from({ length: editable }, (_, i) => (slots[i] ?? '').trim())

  const canCheck = !item
    ? false
    : item.mode === 'typed'
      ? typed.trim() !== ''
      : item.mode === 'frac'
        ? filled.every((s) => s !== '') || free.trim() !== ''
        : figures.every((_, i) => (sel[i] ?? 0) > 0)

  const serialize = () =>
    item!.mode === 'typed'
      ? typed.trim()
      : item!.mode === 'frac'
        ? free.trim() !== ''
          ? free.trim()
          : filled.join('/')
        : sel.join(',')

  const clear = () => {
    setTyped('')
    setSlots([])
    setFree('')
    setSel([])
  }

  const pickCell = (i: number) => (n: number) => {
    const next = [...sel]
    next[i] = n
    setSel(next)
  }
  const editSlot = (i: number, v: string) => {
    const next = [...slots]
    next[i] = v.replace(/\D/g, '')
    setSlots(next)
    setFree('')
  }
  const editFree = (v: string) => {
    setFree(v.replace(/[^\d/ ]/g, ''))
    setSlots([])
  }

  const shownSlots = !reveal ? slots : wrongTyped !== null ? wrongTyped.split(/[\s/]+/) : item!.expected.split(/[\s/]+/)
  const shownSel = reveal ? targets : sel

  return { typed, setTyped, free, sel, canCheck, serialize, clear, pickCell, editSlot, editFree, shownSlots, shownSel }
}
