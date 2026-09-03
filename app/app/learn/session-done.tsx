import * as stylex from '@stylexjs/stylex'
import { q, t } from '@/app/tokens.stylex'
import type { SessionState } from '@/lib/session'
import { chrome } from './chrome'
import { EnterKey } from './ui'

const DONE_REGISTER = {
  doneTitle: 'Stack cleared!',
  doneLine: 'You smashed every block. Come back tomorrow and keep your atoms firm.',
  partialTitle: 'Stack done!',
  partialLine: (left: number) =>
    `${left === 1 ? 'One block comes' : `${left} blocks come`} back tomorrow with fresh numbers, so you can make ${left === 1 ? 'that atom' : 'those atoms'} firm. The rest is yours.`,
  stats: { blocks: 'blocks cleared', firstTry: 'first try', rows: 'atoms firmed', minutes: 'minutes' },
  finish: 'Done',
}

const sessConf = stylex.keyframes({
  '0%': { transform: 'translateY(-30px) rotate(0deg)', opacity: 1 },
  '100%': { transform: 'translateY(260px) rotate(320deg)', opacity: 0 },
})

const sessPop = stylex.keyframes({
  '0%': { transform: 'scale(0.4)', opacity: 0 },
  '70%': { transform: 'scale(1.1)' },
  '100%': { transform: 'scale(1)', opacity: 1 },
})

const s = stylex.create({
  sessdone: {
    position: 'relative',
    overflow: 'hidden',
    paddingTop: '10px',
    paddingBottom: '4px',
  },
  conf: {
    position: 'absolute',
    top: 0,
    width: '9px',
    height: '9px',
    borderRadius: '2px',
    animationName: sessConf,
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.8, 1)',
    animationFillMode: 'both',
  },
  confAt: (left: string, delay: string, duration: string) => ({
    left,
    animationDelay: delay,
    animationDuration: duration,
  }),
  c0: { backgroundColor: t.accent },
  c1: { backgroundColor: `color-mix(in srgb, ${t.ink} 55%, transparent)` },
  c2: { backgroundColor: `color-mix(in srgb, ${t.accent} 55%, ${t.ink})` },
  c3: { backgroundColor: `color-mix(in srgb, ${t.ink} 28%, transparent)` },
  c4: { backgroundColor: `color-mix(in srgb, ${t.accent} 60%, ${t.void})` },
  check: {
    width: '76px',
    height: '76px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    borderRadius: '20px',
    color: 'var(--sesson)',
    backgroundColor: 'var(--sessc)',
    borderWidth: '2.5px',
    borderStyle: 'solid',
    borderColor: 'var(--sessline)',
    boxShadow: '0 6px 0 var(--sessrim)',
    animationName: sessPop,
    animationDuration: '0.5s',
    animationTimingFunction: 'cubic-bezier(0.2, 1.4, 0.4, 1)',
    animationFillMode: 'both',
    '--sessc': `color-mix(in srgb, ${t.accent} 82%, ${t.void})`,
    '--sessrim': {
      default: `color-mix(in srgb, ${t.accent} 45%, ${t.ink})`,
      [q.oklch]: 'oklch(from var(--sessc) calc(l - 0.15) c h)',
    },
    '--sessline': {
      default: `color-mix(in srgb, ${t.ink} 70%, transparent)`,
      [q.oklch]: 'oklch(from var(--sessc) 0.26 calc(c * 0.55) h)',
    },
    '--sesson': {
      default: t.void,
      [q.oklch]: 'oklch(from var(--sessc) 0.97 calc(c * 0.12) h)',
    },
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '30px',
  },
  stat: {
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 22%, transparent)`,
    borderRadius: '14px',
    paddingBlock: '12px',
    paddingInline: '20px',
    minWidth: '96px',
    boxShadow: `0 4px 0 color-mix(in srgb, ${t.ink} 8%, transparent)`,
  },
  statNum: {
    display: 'block',
    fontSize: '26px',
    fontWeight: 750,
  },
  statLabel: {
    fontFamily: t.mono,
    fontSize: '9.5px',
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: t.mut,
  },
})

function firstTryPct(right: number, graded: number): number {
  console.assert(graded >= 1)
  console.assert(right >= 0)
  return Math.round((100 * right) / graded)
}

export function SessionDone({ session, onExit }: { session: SessionState; onExit: () => void }) {
  return (
    <section {...stylex.props(chrome.pintro, s.sessdone)}>
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          {...stylex.props(
            s.conf,
            [s.c0, s.c1, s.c2, s.c3, s.c4][i % 5],
            s.confAt(`${4 + i * 7}%`, `${i * 0.09}s`, `${1.1 + (i % 4) * 0.25}s`),
          )}
        />
      ))}
      <div {...stylex.props(s.check)}>✓</div>
      <h1 {...stylex.props(chrome.h1, chrome.rise)}>
        {session.cleared === session.blocks.length ? DONE_REGISTER.doneTitle : DONE_REGISTER.partialTitle}
      </h1>
      <p {...stylex.props(chrome.lede, chrome.rise)}>
        {session.cleared === session.blocks.length
          ? DONE_REGISTER.doneLine
          : DONE_REGISTER.partialLine(session.blocks.length - session.cleared)}
      </p>
      <div {...stylex.props(s.stats, chrome.rise)}>
        <div {...stylex.props(s.stat)}>
          <b {...stylex.props(s.statNum)}>{session.cleared}</b>
          <span {...stylex.props(s.statLabel)}>{DONE_REGISTER.stats.blocks}</span>
        </div>
        {session.graded > 0 && (
          <div {...stylex.props(s.stat)}>
            <b {...stylex.props(s.statNum)}>{firstTryPct(session.rightFirstTry, session.graded)}%</b>
            <span {...stylex.props(s.statLabel)}>{DONE_REGISTER.stats.firstTry}</span>
          </div>
        )}
        <div {...stylex.props(s.stat)}>
          <b {...stylex.props(s.statNum)}>{session.rowsFirmed.length}</b>
          <span {...stylex.props(s.statLabel)}>{DONE_REGISTER.stats.rows}</span>
        </div>
        <div {...stylex.props(s.stat)}>
          <b {...stylex.props(s.statNum)}>{Math.max(1, Math.round(session.activeMs / 60_000))}</b>
          <span {...stylex.props(s.statLabel)}>{DONE_REGISTER.stats.minutes}</span>
        </div>
      </div>
      <button
        {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, chrome.rise)}
        onClick={onExit}
        data-cuelume-press="press"
        data-cuelume-release="release"
      >
        {DONE_REGISTER.finish}
        <EnterKey />
      </button>
    </section>
  )
}
