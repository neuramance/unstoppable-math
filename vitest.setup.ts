import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

declare const jsdom: { window: Window }

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { value: jsdom.window[name], configurable: true })
}

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

window.HTMLMediaElement.prototype.play = function play() {
  return Promise.resolve()
}
window.HTMLMediaElement.prototype.pause = function pause() {
  return undefined
}

Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: { request: (_name: string, callback: () => Promise<void>) => callback() },
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
