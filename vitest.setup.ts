import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

function memoryStorage(): Storage {
  const s: Record<string, string> = {}
  const hide = (name: string, value: unknown) =>
    Object.defineProperty(s, name, { value, enumerable: false, writable: true })
  hide('getItem', (k: string) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null))
  hide('setItem', (k: string, v: string) => {
    s[k] = String(v)
  })
  hide('removeItem', (k: string) => {
    delete s[k]
  })
  hide('clear', () => {
    for (const k of Object.keys(s)) delete s[k]
  })
  hide('key', (i: number) => Object.keys(s)[i] ?? null)
  Object.defineProperty(s, 'length', { get: () => Object.keys(s).length, enumerable: false })
  return s as unknown as Storage
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(window, name, { value: memoryStorage(), configurable: true })
  Object.defineProperty(globalThis, name, { value: window[name], configurable: true })
}

if (window.matchMedia === undefined) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

window.HTMLMediaElement.prototype.play = function play() {
  return Promise.resolve()
}
window.HTMLMediaElement.prototype.pause = function pause() {
  return undefined
}

if (!('requestFullscreen' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'requestFullscreen', { value: () => Promise.resolve(), writable: true })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
