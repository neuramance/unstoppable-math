import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

if (typeof window !== 'undefined') {
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
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
