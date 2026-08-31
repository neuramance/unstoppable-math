import * as stylex from '@stylexjs/stylex'
import { t } from '@/app/tokens.stylex'
import type { Lesson } from '@/lib/lesson'
import { rowLesson, type RowHistory, type SessionState } from '@/lib/session'
import { chrome } from './chrome'
import { BLOCK_GLYPH, BLOCK_LABEL, KIND_TINT, tints, tintVars } from './session-blocks'

const s = stylex.create({
  devdock: {
    position: 'fixed',
    bottom: '92px',
    left: '16px',
    right: '16px',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
    paddingBlock: '12px',
    paddingInline: '16px',
    maxHeight: '236px',
    overflowY: 'auto',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
    borderRadius: '18px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 4%, ${t.void})`,
    boxShadow: `0 5px 0 color-mix(in srgb, ${t.ink} 8%, transparent)`,
  },
  devdockBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '8px',
    columnGap: '12px',
  },
  devdockHead: {
    fontFamily: t.mono,
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: `color-mix(in srgb, ${t.ink} 55%, transparent)`,
  },
  devatom: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '4px',
    columnGap: '10px',
  },
  devrun: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
  },
  devatomCode: {
    fontFamily: t.sans,
    fontSize: '12.5px',
    fontWeight: 750,
    letterSpacing: '-0.01em',
    color: `color-mix(in srgb, ${t.ink} 60%, transparent)`,
  },
  devatomCodeFirm: {
    color: t.ink,
  },
  devjump: {
    appearance: 'none',
    fontSize: '12px',
    lineHeight: 1,
    width: '30px',
    height: '27px',
    padding: 0,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'var(--sessline)',
    borderRadius: '9px',
    backgroundColor: 'var(--sessc)',
    color: 'var(--sesson)',
    boxShadow: { default: '0 3px 0 var(--sessrim)', ':active': '0 1px 0 var(--sessrim)' },
    cursor: 'pointer',
    transitionProperty: 'transform, box-shadow, opacity, filter',
    transitionDuration: '0.12s',
    transitionTimingFunction: 'ease',
    filter: { default: null, ':hover': 'brightness(1.08)' },
    transform: { default: null, ':active': 'translateY(2px)' },
  },
  devjumpDot: {
    width: '14px',
    height: '13px',
    borderRadius: '5px',
    boxShadow: { default: '0 2px 0 var(--sessrim)', ':active': '0 1px 0 var(--sessrim)' },
  },
  devjumpNow: {
    transform: { default: 'scale(1.25)', ':active': 'scale(1.25) translateY(2px)' },
    marginBlock: 0,
    marginInline: '3px',
    boxShadow: `0 3px 0 var(--sessrim), 0 0 0 2.5px ${t.ink}`,
  },
  devjumpDim: {
    opacity: { default: 0.45, ':hover': 1, ':focus-visible': 1 },
  },
  devreset: {
    appearance: 'none',
    display: 'inline-block',
    margin: 0,
    fontFamily: t.mono,
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: { default: `color-mix(in srgb, ${t.ink} 55%, transparent)`, ':hover': t.ink },
    paddingBlock: '7px',
    paddingInline: '14px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: {
      default: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
      ':hover': `color-mix(in srgb, ${t.ink} 30%, transparent)`,
    },
    borderRadius: '999px',
    backgroundColor: 'transparent',
    boxShadow: {
      default: `0 3px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
      ':active': `0 1px 0 color-mix(in srgb, ${t.ink} 12%, transparent)`,
    },
    transform: { default: null, ':active': 'translateY(2px)' },
    cursor: 'pointer',
    transitionProperty: 'color, border-color',
    transitionDuration: '0.18s',
    transitionTimingFunction: 'ease',
  },
  devresetOn: {
    color: t.ink,
    borderColor: `color-mix(in srgb, ${t.ink} 35%, transparent)`,
  },
})

export function DevDock({
  lesson,
  auto,
  onAuto,
  onReset,
  onJump,
  playing,
  activeBlock,
  atItem,
  history,
  atomRows,
  atomOf,
}: {
  lesson: Lesson
  auto: boolean
  onAuto: (next: boolean) => void
  onReset: () => void
  onJump: (row: number | null, now: number, kind?: 'instruction' | 'testing', item?: number) => void
  playing: boolean
  activeBlock: SessionState['blocks'][number] | null
  atItem: number | null
  history: RowHistory | null
  atomRows: number[]
  atomOf: (row: number) => string
}) {
  const storyNow = playing && activeBlock?.plan.kind === 'narrative'
  const anyNow = storyNow || (playing && activeBlock?.plan.kind !== 'narrative' && atItem !== null)

  return (
    <aside {...stylex.props(s.devdock, chrome.rise)}>
      <div {...stylex.props(s.devdockBar)}>
        <span {...stylex.props(s.devdockHead)}>navigator</span>
        <button
          {...stylex.props(s.devreset, auto && s.devresetOn)}
          aria-pressed={auto}
          onClick={() => onAuto(!auto)}
          data-cuelume-press="press"
        >
          {auto ? 'Stop autoplay' : 'Autoplay session'}
        </button>
        <button {...stylex.props(s.devreset)} onClick={onReset} data-cuelume-press="press">
          Reset history
        </button>
        {lesson.narrative && (
          <button
            {...stylex.props(
              s.devjump,
              tintVars.tint,
              tints.narrative,
              storyNow && s.devjumpNow,
              anyNow && !storyNow && s.devjumpDim,
            )}
            onClick={() => onJump(null, Date.now())}
            data-cuelume-press="tick"
            aria-label="story"
            title="story"
          >
            {BLOCK_GLYPH.narrative}
          </button>
        )}
      </div>
      {atomRows.map((row) => {
        const active = playing && activeBlock?.plan.rows.some((r) => r.row === row) ? activeBlock.plan.kind : null
        const side = active === 'review' ? 'testing' : active
        const firmed = history?.get(row)?.firmed ?? false
        return (
          <div key={row} {...stylex.props(s.devatom)}>
            <span {...stylex.props(s.devatomCode, firmed && s.devatomCodeFirm)}>{atomOf(row)}</span>
            {(['instruction', 'testing'] as const).map((kind) => {
              const pieces = rowLesson(lesson, { row, set: 1 }, kind).items
              if (pieces.length === 0) return null
              const word = kind === 'instruction' ? 'instruction' : 'checking'
              return (
                <span key={kind} {...stylex.props(s.devrun)}>
                  <button
                    {...stylex.props(s.devjump, tintVars.tint, KIND_TINT[kind], anyNow && s.devjumpDim)}
                    onClick={() => onJump(row, Date.now(), kind)}
                    data-cuelume-press="tick"
                    aria-label={`atom ${atomOf(row)} ${word}`}
                    title={`${atomOf(row)} · ${BLOCK_LABEL[kind]}`}
                  >
                    {BLOCK_GLYPH[kind]}
                  </button>
                  {pieces.map((piece, i) => {
                    const nowDot = side === kind && atItem === i
                    return (
                      <button
                        key={i}
                        {...stylex.props(
                          s.devjump,
                          s.devjumpDot,
                          tintVars.tint,
                          KIND_TINT[kind],
                          nowDot && s.devjumpNow,
                          anyNow && !nowDot && s.devjumpDim,
                        )}
                        onClick={() => onJump(row, Date.now(), kind, i)}
                        data-cuelume-press="tick"
                        aria-label={`atom ${atomOf(row)} ${word} ${i + 1} of ${pieces.length}`}
                        title={`${i + 1} of ${pieces.length} · ${piece.prompt}`}
                      />
                    )
                  })}
                </span>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}
