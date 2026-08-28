import * as stylex from '@stylexjs/stylex'
import { useEffect, useRef, useState } from 'react'
import type { ThemeName } from '@/app/theme-class'
import { d, t } from '@/app/tokens.stylex'
import { activeId, readItem, writeItem } from '@/lib/store'

const DEFAULT_NAME = 'Learner'
const DEFAULT_EMOJI = '🦊'

function avatarInkHi(h: number): number {
  console.assert(h >= 0)
  console.assert(h <= 996)
  return 16 - (h % 9)
}

function avatarInkLo(h: number): number {
  console.assert(h >= 0)
  console.assert(h <= 996)
  return 7 - (h % 4)
}

function avatarGradient(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997
  const hi = avatarInkHi(h)
  const lo = avatarInkLo(h)
  return `linear-gradient(${h % 360}deg, color-mix(in srgb, ${t.ink} ${hi}%, ${t.void}), color-mix(in srgb, ${t.ink} ${lo}%, ${t.void}))`
}

const swatch = stylex.create({
  light: { backgroundColor: '#ffffff' },
  paper: { backgroundColor: '#f8f7f3' },
  dark: { backgroundColor: '#0e0f11' },
  pure: { backgroundColor: '#000000' },
  classic: { backgroundColor: '#181818' },
})

const THEMES: { id: ThemeName; label: string; swatch: stylex.StyleXStyles }[] = [
  { id: 'light', label: 'Light', swatch: swatch.light },
  { id: 'paper', label: 'Paper', swatch: swatch.paper },
  { id: 'dark', label: 'Dark', swatch: swatch.dark },
  { id: 'pure', label: 'Pure Dark', swatch: swatch.pure },
  { id: 'classic', label: 'Dark Classic', swatch: swatch.classic },
]

const THEME_STORE = 'um.theme'

type Profile = { name?: string; emoji?: string }

const EMOJI: { glyph: string; label: string }[] = [
  { glyph: '🦊', label: 'Fox' },
  { glyph: '🐼', label: 'Panda' },
  { glyph: '🐸', label: 'Frog' },
  { glyph: '🦄', label: 'Unicorn' },
  { glyph: '🐙', label: 'Octopus' },
  { glyph: '🦖', label: 'Dinosaur' },
  { glyph: '🚀', label: 'Rocket' },
  { glyph: '⭐', label: 'Star' },
]

const profileStore = (id: string) => `um.profile:${id}`

function loadProfile(id: string): Profile {
  try {
    return JSON.parse(readItem(profileStore(id)) ?? '{}') as Profile
  } catch {
    return {}
  }
}

function displayed(p: Profile): { name: string; glyph: string } {
  const name = (p.name ?? '').trim().slice(0, 24) || DEFAULT_NAME
  return { name, glyph: p.emoji ?? DEFAULT_EMOJI }
}

export function activeTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_STORE)
    return THEMES.some((x) => x.id === stored) ? (stored as ThemeName) : 'paper'
  } catch {
    return 'paper'
  }
}

const MOBILE = '@media (max-width: 743px)'

const s = stylex.create({
  wrap: {
    position: 'fixed',
    left: t.rail,
    bottom: '16px',
    zIndex: 31,
    maxWidth: 'calc(100vw - 32px)',
  },
  upill: {
    appearance: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: { default: '12px', [MOBILE]: 0 },
    width: { default: '256px', [MOBILE]: 'auto' },
    maxWidth: '100%',
    paddingBlock: { default: '10px', [MOBILE]: '6px' },
    paddingInline: { default: '14px', [MOBILE]: '6px' },
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
    borderRadius: '18px',
    backgroundColor: {
      default: `color-mix(in srgb, ${t.ink} 4%, ${t.void})`,
      ':hover': `color-mix(in srgb, ${t.ink} 8%, ${t.void})`,
    },
    color: t.ink,
    fontFamily: 'inherit',
    textAlign: 'left',
    boxShadow: {
      default: `0 3px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
      ':active': `0 1px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
    },
    transform: { default: null, ':active': 'translateY(2px)' },
    cursor: 'pointer',
    transitionProperty: 'transform, box-shadow, background-color',
    transitionDuration: '0.12s, 0.12s, 0.18s',
    transitionTimingFunction: 'ease',
  },
  uavatar: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: d.line,
    fontSize: '17px',
    fontWeight: 620,
    color: `color-mix(in srgb, ${t.ink} 85.5%, ${t.void})`,
  },
  uavatarEmoji: {
    fontSize: '21px',
  },
  avatarBg: (bg: string) => ({ backgroundImage: bg }),
  uid: {
    display: { default: 'flex', [MOBILE]: 'none' },
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
  },
  uname: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  uhandle: {
    fontSize: '14px',
    color: t.mut,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  ubadge: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '17px',
    height: '17px',
    fill: '#1d9bf0',
  },
  udots: {
    display: { default: null, [MOBILE]: 'none' },
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    color: t.ink,
    fontWeight: 700,
    letterSpacing: '1px',
  },
  umenu: {
    position: 'absolute',
    bottom: 'calc(100% + 16px)',
    left: 0,
    width: '300px',
    maxWidth: 'calc(100vw - 32px)',
    paddingBlock: '10px',
    paddingInline: 0,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
    borderRadius: '18px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 4%, ${t.void})`,
    boxShadow: `0 5px 0 color-mix(in srgb, ${t.ink} 8%, transparent)`,
    '::after': {
      content: '""',
      position: 'absolute',
      bottom: '-8px',
      left: '42px',
      width: '12px',
      height: '12px',
      backgroundColor: `color-mix(in srgb, ${t.ink} 4%, ${t.void})`,
      borderRightWidth: '2px',
      borderRightStyle: 'solid',
      borderRightColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
      borderBottomWidth: '2px',
      borderBottomStyle: 'solid',
      borderBottomColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
      transform: 'rotate(45deg)',
    },
  },
  urow: {
    appearance: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    paddingBlock: '12px',
    paddingInline: '16px',
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: {
      default: 'transparent',
      ':hover': `color-mix(in srgb, ${t.ink} 5%, transparent)`,
    },
    color: t.ink,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: '0.18s',
    transitionTimingFunction: 'ease',
  },
  uaction: {
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  udivider: {
    height: '1px',
    marginBlock: '8px',
    marginInline: 0,
    backgroundColor: d.line,
  },
  uvalue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    marginLeft: 'auto',
    fontSize: '13px',
    fontWeight: 500,
    color: t.mut,
  },
  uchev: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '12px',
    height: '12px',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  uback: {
    gap: '8px',
    paddingBlock: '8px',
    paddingInline: '16px',
    fontSize: '13px',
    fontWeight: 590,
    color: {
      default: `color-mix(in srgb, ${t.ink} 55%, transparent)`,
      ':hover': t.ink,
    },
  },
  ulabel: {
    fontSize: '14.5px',
    fontWeight: 560,
  },
  uswatch: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 25%, transparent)`,
  },
  utick: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '14px',
    height: '14px',
    marginLeft: 'auto',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  ufield: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingBlock: '10px',
    paddingInline: '16px',
  },
  uflabel: {
    fontSize: '12px',
    fontWeight: 560,
    letterSpacing: '0.01em',
    color: t.mut,
  },
  uinput: {
    width: '100%',
    paddingBlock: '8px',
    paddingInline: '10px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 22%, transparent)`,
    borderRadius: '10px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 3%, transparent)`,
    boxShadow: `inset 0 2px 0 color-mix(in srgb, ${t.ink} 5%, transparent)`,
    color: t.ink,
    fontFamily: 'inherit',
    fontSize: '14px',
  },
  ugrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  uemoji: {
    appearance: 'none',
    display: 'grid',
    placeItems: 'center',
    paddingBlock: '8px',
    paddingInline: 0,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 16%, transparent)`,
    borderRadius: '10px',
    backgroundColor: {
      default: `color-mix(in srgb, ${t.ink} 4%, transparent)`,
      ':hover': `color-mix(in srgb, ${t.ink} 8%, transparent)`,
    },
    fontSize: '22px',
    lineHeight: 1,
    boxShadow: {
      default: `0 2px 0 color-mix(in srgb, ${t.ink} 10%, transparent)`,
      ':active': 'none',
    },
    transform: { default: null, ':active': 'translateY(2px)' },
    cursor: 'pointer',
    transitionProperty: 'transform, box-shadow, background-color, border-color',
    transitionDuration: '0.12s, 0.12s, 0.18s, 0.18s',
    transitionTimingFunction: 'ease',
  },
  uemojiOn: {
    borderColor: t.ink,
    backgroundColor: `color-mix(in srgb, ${t.ink} 10%, transparent)`,
  },
})

function Avatar({ id, p }: { id: string; p: Profile }) {
  return (
    <span {...stylex.props(s.uavatar, s.uavatarEmoji, s.avatarBg(avatarGradient(id)))} aria-hidden="true">
      {displayed(p).glyph}
    </span>
  )
}

function Badge() {
  return (
    <svg {...stylex.props(s.ubadge)} viewBox="0 0 22 22" aria-label="Verified">
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  )
}

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg {...stylex.props(s.uchev)} viewBox="0 0 12 12" aria-hidden="true">
      <path d={back ? 'M7.5 2.5 4 6l3.5 3.5' : 'M4.5 2.5 8 6l-3.5 3.5'} />
    </svg>
  )
}

function Tick() {
  return (
    <svg {...stylex.props(s.utick)} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-7" />
    </svg>
  )
}

export function UserPill({ theme, onTheme }: { theme: ThemeName; onTheme: (next: ThemeName) => void }) {
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<'menu' | 'settings' | 'theme'>('menu')
  const wrapRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLButtonElement>(null)
  const id = activeId()
  const [profile, setProfile] = useState<Profile>(() => loadProfile(id))
  const [lastId, setLastId] = useState(id)
  if (id !== lastId) {
    setLastId(id)
    setProfile(loadProfile(id))
  }

  const patchProfile = (patch: Profile) => {
    const next = { ...profile, ...patch }
    writeItem(profileStore(id), JSON.stringify(next))
    setProfile(next)
  }

  const toggleMenu = () => {
    setPane('menu')
    if (!open) setProfile(loadProfile(id))
    setOpen(!open)
  }

  const pickTheme = (next: ThemeName) => {
    try {
      localStorage.setItem(THEME_STORE, next)
    } catch {}
    onTheme(next)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrapRef.current!.contains(e.target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        pillRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div {...stylex.props(s.wrap)} ref={wrapRef}>
      <button
        ref={pillRef}
        {...stylex.props(s.upill)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
        data-cuelume-press="tick"
      >
        <Avatar id={id} p={profile} />
        <span {...stylex.props(s.uid)}>
          <span {...stylex.props(s.uname)}>
            {displayed(profile).name}
            <Badge />
          </span>
          <span {...stylex.props(s.uhandle)}>@{id.slice(0, 8)}</span>
        </span>
        <span {...stylex.props(s.udots)} aria-hidden="true">
          ···
        </span>
      </button>
      {open && (
        <div {...stylex.props(s.umenu)} role="menu" aria-label="Account">
          {pane === 'menu' ? (
            <>
              <button
                {...stylex.props(s.urow, s.uaction)}
                role="menuitem"
                aria-haspopup="menu"
                onClick={() => setPane('settings')}
                data-cuelume-press="tick"
              >
                Account settings
                <span {...stylex.props(s.uvalue)}>
                  <Chevron />
                </span>
              </button>
              <button
                {...stylex.props(s.urow, s.uaction)}
                role="menuitem"
                aria-haspopup="menu"
                onClick={() => setPane('theme')}
                data-cuelume-press="tick"
              >
                Theme
                <span {...stylex.props(s.uvalue)}>
                  {THEMES.find((x) => x.id === theme)!.label}
                  <Chevron />
                </span>
              </button>
            </>
          ) : pane === 'settings' ? (
            <>
              <button {...stylex.props(s.urow, s.uback)} onClick={() => setPane('menu')} data-cuelume-press="tick">
                <Chevron back />
                Account settings
              </button>
              <div {...stylex.props(s.udivider)} />
              <div {...stylex.props(s.ufield)}>
                <label {...stylex.props(s.uflabel)} htmlFor="uname-input">
                  Display name
                </label>
                <input
                  id="uname-input"
                  {...stylex.props(s.uinput)}
                  type="text"
                  maxLength={24}
                  value={profile.name ?? DEFAULT_NAME}
                  onChange={(e) => patchProfile({ name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div {...stylex.props(s.ufield)}>
                <p {...stylex.props(s.uflabel)}>Profile picture</p>
                <div {...stylex.props(s.ugrid)} role="group" aria-label="Profile picture">
                  {EMOJI.map((e) => {
                    const on = (profile.emoji ?? DEFAULT_EMOJI) === e.glyph
                    return (
                      <button
                        key={e.glyph}
                        {...stylex.props(s.uemoji, on && s.uemojiOn)}
                        aria-pressed={on}
                        aria-label={e.label}
                        onClick={() => patchProfile({ emoji: on ? undefined : e.glyph })}
                        data-cuelume-press="tick"
                      >
                        {e.glyph}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <button {...stylex.props(s.urow, s.uback)} onClick={() => setPane('menu')} data-cuelume-press="tick">
                <Chevron back />
                Theme
              </button>
              <div {...stylex.props(s.udivider)} />
              {THEMES.map((x) => (
                <button
                  key={x.id}
                  {...stylex.props(s.urow)}
                  role="menuitemradio"
                  aria-checked={x.id === theme}
                  onClick={() => pickTheme(x.id)}
                  data-cuelume-press="tick"
                >
                  <span {...stylex.props(s.uswatch, x.swatch)} aria-hidden="true" />
                  <span {...stylex.props(s.ulabel)}>{x.label}</span>
                  {x.id === theme && <Tick />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
