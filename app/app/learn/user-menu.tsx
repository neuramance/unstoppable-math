import * as stylex from '@stylexjs/stylex'
import type { ThemeName } from '@/app/theme-class'
import { d, t } from '@/app/tokens.stylex'
import { readItem, writeItem } from '@/lib/store'

export const DEFAULT_NAME = 'Learner'
export const DEFAULT_EMOJI = '\u{1F98A}'

const swatch = stylex.create({
  light: { backgroundColor: '#ffffff' },
  paper: { backgroundColor: '#f8f7f3' },
  dark: { backgroundColor: '#0e0f11' },
  pure: { backgroundColor: '#000000' },
  classic: { backgroundColor: '#181818' },
})

export const THEMES: { id: ThemeName; label: string; swatch: stylex.StyleXStyles }[] = [
  { id: 'light', label: 'Light', swatch: swatch.light },
  { id: 'paper', label: 'Paper', swatch: swatch.paper },
  { id: 'dark', label: 'Dark', swatch: swatch.dark },
  { id: 'pure', label: 'Pure Dark', swatch: swatch.pure },
  { id: 'classic', label: 'Dark Classic', swatch: swatch.classic },
]

const THEME_STORE = 'um.theme'

export type Profile = { name?: string; emoji?: string }

const EMOJI: { glyph: string; label: string }[] = [
  { glyph: '\u{1F98A}', label: 'Fox' },
  { glyph: '\u{1F43C}', label: 'Panda' },
  { glyph: '\u{1F438}', label: 'Frog' },
  { glyph: '\u{1F984}', label: 'Unicorn' },
  { glyph: '\u{1F419}', label: 'Octopus' },
  { glyph: '\u{1F996}', label: 'Dinosaur' },
  { glyph: '\u{1F680}', label: 'Rocket' },
  { glyph: '\u2B50', label: 'Star' },
]

export const profileStore = (id: string) => `um.profile:${id}`

export function loadProfile(id: string): Profile {
  try {
    return JSON.parse(readItem(profileStore(id)) ?? '{}') as Profile
  } catch {
    return {}
  }
}

export function displayed(p: Profile): { name: string; glyph: string } {
  const name = (p.name ?? '').trim().slice(0, 24) || DEFAULT_NAME
  return { name, glyph: p.emoji ?? DEFAULT_EMOJI }
}

export function activeTheme(): ThemeName {
  const stored = readItem(THEME_STORE)
  return THEMES.some((x) => x.id === stored) ? (stored as ThemeName) : 'paper'
}

const s = stylex.create({
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

export function AccountMenu({
  pane,
  onPane,
  theme,
  onTheme,
  profile,
  onPatch,
}: {
  pane: 'menu' | 'settings' | 'theme'
  onPane: (p: 'menu' | 'settings' | 'theme') => void
  theme: ThemeName
  onTheme: (next: ThemeName) => void
  profile: Profile
  onPatch: (patch: Profile) => void
}) {
  const pickTheme = (next: ThemeName) => {
    writeItem(THEME_STORE, next)
    onTheme(next)
  }

  return (
    <div {...stylex.props(s.umenu)} role="menu" aria-label="Account">
      {pane === 'menu' ? (
        <>
          <button
            {...stylex.props(s.urow, s.uaction)}
            role="menuitem"
            aria-haspopup="menu"
            onClick={() => onPane('settings')}
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
            onClick={() => onPane('theme')}
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
          <button {...stylex.props(s.urow, s.uback)} onClick={() => onPane('menu')} data-cuelume-press="tick">
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
              onChange={(e) => onPatch({ name: e.target.value })}
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
                    onClick={() => onPatch({ emoji: on ? undefined : e.glyph })}
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
          <button {...stylex.props(s.urow, s.uback)} onClick={() => onPane('menu')} data-cuelume-press="tick">
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
  )
}
