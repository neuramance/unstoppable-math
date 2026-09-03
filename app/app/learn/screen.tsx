import * as stylex from '@stylexjs/stylex'
import { bind } from 'cuelume'
import { useEffect, useLayoutEffect, useState } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { THEME_CLASS, type ThemeName } from '@/app/theme-class'
import { t } from '@/app/tokens.stylex'
import { openStore, readItem, writeItem } from '@/lib/store'
import { Boundary } from './boundary'
import { chrome } from './chrome'
import { Intro } from './intro'
import { introPending } from './use-intro'
import { Learn } from './learn'
import { activeTheme, UserPill } from './user-pill'

const DEV_STORE = 'um.dev'

function devParam(): boolean | null {
  const p = new URLSearchParams(location.search).get('dev')
  return p === '1' ? true : p === '0' ? false : null
}

function writeDev(on: boolean) {
  writeItem(DEV_STORE, on ? '1' : '0')
}

function exitToApp() {
  window.location.assign('/app')
}

let bound = false

const s = stylex.create({
  cornerLogo: {
    position: 'fixed',
    top: '26px',
    left: `calc(${t.rail} + 13px)`,
    zIndex: 6,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    whiteSpace: 'nowrap',
  },
  cornerLogoInvert: {
    filter: 'invert(1)',
  },
  appshell: {
    minHeight: '100svh',
  },
  pback: {
    appearance: 'none',
    position: 'fixed',
    top: '26px',
    left: '76px',
    zIndex: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'none',
    paddingTop: '6px',
    paddingInline: '14px',
    paddingBottom: '10px',
    fontFamily: t.mono,
    fontSize: '28px',
    lineHeight: 1,
    color: {
      default: `color-mix(in srgb, ${t.ink} 55%, transparent)`,
      ':hover': t.ink,
    },
    cursor: 'pointer',
    transitionProperty: 'color',
    transitionDuration: '0.18s',
    transitionTimingFunction: 'ease',
  },
  devtoggle: {
    appearance: 'none',
    position: 'fixed',
    right: '18px',
    bottom: '16px',
    zIndex: 5,
    fontFamily: t.mono,
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: {
      default: `color-mix(in srgb, ${t.ink} 55%, transparent)`,
      ':hover': t.ink,
    },
    paddingBlock: '8px',
    paddingInline: '14px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
    borderRadius: '12px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 4%, ${t.void})`,
    boxShadow: {
      default: `0 3px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
      ':active': `0 1px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
    },
    transform: { default: null, ':active': 'translateY(2px)' },
    cursor: 'pointer',
    transitionProperty: 'transform, box-shadow, color, border-color',
    transitionDuration: '0.12s, 0.12s, 0.18s, 0.18s',
    transitionTimingFunction: 'ease',
  },
  devtoggleOn: {
    color: t.ink,
    borderColor: `color-mix(in srgb, ${t.ink} 35%, transparent)`,
  },
})

function ScreenView() {
  const [dev, setDev] = useState(() => devParam() ?? readItem(DEV_STORE) !== '0')
  useEffect(() => {
    const p = devParam()
    if (p === null) return
    writeDev(p)
    const url = new URL(location.href)
    url.searchParams.delete('dev')
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])
  const toggleDev = () => {
    writeDev(!dev)
    setDev(!dev)
  }

  return (
    <div {...stylex.props(chrome.place)}>
      <button {...stylex.props(s.pback)} onClick={exitToApp} aria-label="Back" data-cuelume-press="tick">
        ‹
      </button>
      <Learn dev={dev} onExit={exitToApp} />
      <button
        {...stylex.props(s.devtoggle, dev && s.devtoggleOn)}
        aria-pressed={dev}
        onClick={toggleDev}
        data-cuelume-press="press"
      >
        dev mode · {dev ? 'on' : 'off'}
      </button>
    </div>
  )
}

export default function Screen() {
  const [intro, setIntro] = useState(introPending)
  const [store, setStore] = useState(false)
  const [theme, setTheme] = useState<ThemeName>(activeTheme)

  useEffect(() => {
    if (bound) return
    bound = true
    bind()
  }, [])

  useEffect(() => {
    void openStore().then(() => setStore(true))
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    for (const classes of Object.values(THEME_CLASS)) {
      for (const cls of classes.split(' ')) if (cls !== '') root.classList.remove(cls)
    }
    if (theme === 'classic') delete root.dataset.theme
    else root.dataset.theme = theme
    for (const cls of THEME_CLASS[theme].split(' ')) if (cls !== '') root.classList.add(cls)
  }, [theme])

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        {...stylex.props(s.cornerLogo, (theme === 'light' || theme === 'paper') && s.cornerLogoInvert)}
        href="/"
        aria-label="Unstoppable Math"
      >
        <ThinkingOrb
          state="solving"
          theme="dark"
          aria-hidden
          size={64}
          style={{ width: 42, height: 42 }}
          paused
          speed={0}
        />
      </a>
      <div {...stylex.props(s.appshell)} data-appshell="" inert={intro}>
        <Boundary>{store && <ScreenView />}</Boundary>
      </div>
      <UserPill theme={theme} onTheme={setTheme} />
      {intro && <Intro onDone={() => setIntro(false)} />}
    </>
  )
}
