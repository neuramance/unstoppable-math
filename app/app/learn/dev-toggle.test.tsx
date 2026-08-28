import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import Screen from './screen'

vi.mock('./learn', () => ({ Learn: () => null }))

const DEV_STORE = 'um.dev'

beforeEach(() => {
  sessionStorage.setItem('um.intro-seen', '1')
})

type View = ReturnType<typeof render>

async function mount(search = ''): Promise<View> {
  window.history.replaceState({}, '', `/app/learn${search}`)
  const view = render(<Screen />)
  await act(async () => {})
  return view
}

function pill(view: View) {
  return view.queryByRole('button', { name: /dev mode/ })
}

function readPill(view: View) {
  const el = pill(view)
  if (!el) return { present: false as const }
  return {
    present: true as const,
    pressed: el.getAttribute('aria-pressed'),
    label: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }
}

function clickPill(view: View) {
  const el = pill(view)
  if (!el) throw new Error('the pill is not on screen, so it cannot be clicked')
  fireEvent.click(el)
}

test('a visitor with nothing stored gets the pill, reading on', async () => {
  const view = await mount()
  expect(readPill(view)).toEqual({ present: true, pressed: 'true', label: 'dev mode · on' })
  view.unmount()
})

test('clicking the pill off leaves the pill on screen, now reading off', async () => {
  const view = await mount()
  clickPill(view)
  expect(readPill(view)).toEqual({ present: true, pressed: 'false', label: 'dev mode · off' })
  expect(localStorage.getItem(DEV_STORE)).toBe('0')
  view.unmount()
})

test('the same pill turns it back on, with no URL and no reload', async () => {
  const view = await mount()
  clickPill(view)
  clickPill(view)
  expect(readPill(view)).toEqual({ present: true, pressed: 'true', label: 'dev mode · on' })
  expect(localStorage.getItem(DEV_STORE)).toBe('1')
  view.unmount()
})

test('the switch survives being clicked many times and never goes missing', async () => {
  const view = await mount()
  for (let i = 1; i <= 12; i++) {
    clickPill(view)
    const want = i % 2 === 0
    expect({ i, ...readPill(view) }).toEqual({
      i,
      present: true,
      pressed: String(want),
      label: `dev mode · ${want ? 'on' : 'off'}`,
    })
  }
  view.unmount()
})

test('an off stored earlier still shows the pill on the next visit, so there is a way back', async () => {
  localStorage.setItem(DEV_STORE, '0')
  const view = await mount()
  expect(readPill(view)).toEqual({ present: true, pressed: 'false', label: 'dev mode · off' })
  clickPill(view)
  expect(readPill(view)).toEqual({ present: true, pressed: 'true', label: 'dev mode · on' })
  expect(localStorage.getItem(DEV_STORE)).toBe('1')
  view.unmount()
})

test('the choice persists across a remount, in both directions', async () => {
  const first = await mount()
  clickPill(first)
  first.unmount()
  const second = await mount()
  expect(readPill(second)).toEqual({ present: true, pressed: 'false', label: 'dev mode · off' })
  clickPill(second)
  second.unmount()
  const third = await mount()
  expect(readPill(third)).toEqual({ present: true, pressed: 'true', label: 'dev mode · on' })
  third.unmount()
})

test('?dev=0 turns it off, stores the choice and strips itself, and the pill stays put', async () => {
  const view = await mount('?dev=0')
  expect(readPill(view)).toEqual({ present: true, pressed: 'false', label: 'dev mode · off' })
  expect(localStorage.getItem(DEV_STORE)).toBe('0')
  expect(location.search).toBe('')
  view.unmount()
})

test('?dev=1 overrides a stored off, which is the documented way back in', async () => {
  localStorage.setItem(DEV_STORE, '1')
  const off = await mount('?dev=0')
  expect(readPill(off).pressed).toBe('false')
  off.unmount()
  const on = await mount('?dev=1')
  expect(readPill(on)).toEqual({ present: true, pressed: 'true', label: 'dev mode · on' })
  expect(localStorage.getItem(DEV_STORE)).toBe('1')
  expect(location.search).toBe('')
  on.unmount()
})
