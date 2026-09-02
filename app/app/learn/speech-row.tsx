import * as stylex from '@stylexjs/stylex'
import { t } from '@/app/tokens.stylex'
import { chrome } from './chrome'

const REDUCED = '@media (prefers-reduced-motion: reduce)'

const pulseKf = stylex.keyframes({
  '0%': { opacity: 0.35, transform: 'scale(0.82)' },
  '50%': { opacity: 1, transform: 'scale(1)' },
  '100%': { opacity: 0.35, transform: 'scale(0.82)' },
})

const styles = stylex.create({
  heard: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    minHeight: '20px',
    marginTop: '14px',
    fontFamily: t.mono,
    fontSize: '12px',
    letterSpacing: '0.08em',
    color: t.mut,
  },
  saying: {
    color: t.ink,
    letterSpacing: '0.01em',
    textTransform: 'none',
  },
  waiting: {
    textTransform: 'uppercase',
  },
  dot: {
    flexGrow: 0,
    flexShrink: 0,
    width: '9px',
    height: '9px',
    borderRadius: '999px',
    backgroundColor: t.accent,
    animationName: { default: pulseKf, [REDUCED]: null },
    animationDuration: '1.4s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },
})

export function MicPill({ on, onMic }: { on: boolean; onMic: (next: boolean) => void }) {
  return (
    <button
      {...stylex.props(chrome.pill, on && chrome.pillOn)}
      aria-pressed={on}
      aria-label="Microphone"
      onClick={() => onMic(!on)}
      data-cuelume-press="tick"
    >
      {on ? 'mic on' : 'mic'}
    </button>
  )
}

export function Heard({ listening, interim }: { listening: boolean; interim: string }) {
  if (!listening) return null
  return (
    <p {...stylex.props(styles.heard, interim === '' ? styles.waiting : styles.saying)}>
      <span {...stylex.props(styles.dot)} aria-hidden="true" />
      {interim === '' ? 'listening' : interim}
    </p>
  )
}
