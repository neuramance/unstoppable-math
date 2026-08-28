import * as stylex from '@stylexjs/stylex'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { removeItem } from '@/lib/store'
import { chrome } from './chrome'

const PROGRESS_PREFIXES = ['um.placement.', 'um.session.', 'um.lesson.']

function clearProgress() {
  let keys: string[] = []
  try {
    keys = Object.keys(localStorage).filter((k) => PROGRESS_PREFIXES.some((p) => k.startsWith(p)))
  } catch {}
  void Promise.allSettled(keys.map((k) => removeItem(k))).then(() => location.reload())
}

const s = stylex.create({
  ctarow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
  },
})

export class Boundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('render failed under the app shell', error, info.componentStack)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div {...stylex.props(chrome.place)}>
        <section {...stylex.props(chrome.pintro)}>
          <p {...stylex.props(chrome.eyebrow)}>App recovery</p>
          <p {...stylex.props(chrome.lede)}>
            {
              "This screen stopped short, and that is on us. Your saved progress is still here, so reload to pick up where you left off. If the same screen keeps stopping, clear this device's saved progress and begin again."
            }
          </p>
          <div {...stylex.props(s.ctarow)}>
            <button
              {...stylex.props(chrome.btn, chrome.ghost)}
              onClick={() => location.reload()}
              data-cuelume-press="press"
            >
              Reload
            </button>
            <button {...stylex.props(chrome.btn, chrome.ghost)} onClick={clearProgress} data-cuelume-press="press">
              Clear saved progress
            </button>
          </div>
        </section>
      </div>
    )
  }
}
