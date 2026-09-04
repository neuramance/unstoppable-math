import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { activeId } from '@/lib/store'
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
})

test('every click flips the pill and the stored choice, with no URL and no reload, and it never goes missing', async () => {
  const view = await mount()
  for (let i = 1; i <= 12; i++) {
    clickPill(view)
    const want = i % 2 === 0
    expect({ i, stored: localStorage.getItem(DEV_STORE), ...readPill(view) }).toEqual({
      i,
      stored: want ? '1' : '0',
      present: true,
      pressed: String(want),
      label: `dev mode · ${want ? 'on' : 'off'}`,
    })
  }
})

test('the choice persists across a remount in both directions, so a stored off still has a way back', async () => {
  const first = await mount()
  clickPill(first)
  first.unmount()
  const second = await mount()
  expect(readPill(second)).toEqual({ present: true, pressed: 'false', label: 'dev mode · off' })
  clickPill(second)
  expect(readPill(second)).toEqual({ present: true, pressed: 'true', label: 'dev mode · on' })
  expect(localStorage.getItem(DEV_STORE)).toBe('1')
  second.unmount()
  const third = await mount()
  expect(readPill(third)).toEqual({ present: true, pressed: 'true', label: 'dev mode · on' })
})

test('?dev=0 turns it off, stores the choice and strips itself, and the pill stays put', async () => {
  const view = await mount('?dev=0')
  expect(readPill(view)).toEqual({ present: true, pressed: 'false', label: 'dev mode · off' })
  expect(localStorage.getItem(DEV_STORE)).toBe('0')
  expect(location.search).toBe('')
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
})

test.each(['null', '42', '[]', '{"name":42}', '{"emoji":{}}', '{invalid'])(
  'a malformed profile %s falls back without entering recovery or clearing progress',
  async (raw) => {
    const key = `um.session.nf-fractions:${activeId()}`
    localStorage.setItem(key, '[1]')
    localStorage.setItem(`um.profile:${activeId()}`, raw)
    const view = await mount()
    expect(view.getByRole('button', { name: /Learner/ })).toBeTruthy()
    expect(view.queryByText('App recovery')).toBeNull()
    expect(localStorage.getItem(key)).toBe('[1]')
  },
)

test('a valid saved profile keeps its name and avatar', async () => {
  localStorage.setItem(`um.profile:${activeId()}`, JSON.stringify({ name: 'Alex', emoji: '🐼' }))
  const view = await mount()
  expect(view.getByRole('button', { name: /Alex/ }).textContent).toContain('🐼')
})
