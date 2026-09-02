import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { t } from '@/app/tokens.stylex'
import type { Lesson } from '@/lib/lesson'
import { rowLesson, type RowHistory, type SessionState } from '@/lib/session'
import { chrome } from './chrome'
import { BLOCK_GLYPH, tints, tintVars } from './session-blocks'

const KINDS = ['instruction', 'testing'] as const
const KIND_WORD = { instruction: 'instruction', testing: 'checking' } as const
const KIND_LABEL = { instruction: 'Instruction', testing: 'Checking' } as const
const KIND_GLYPH = { instruction: '★', testing: '✎' } as const
const KIND_ROLE = { instruction: 'model', testing: 'test' } as const
const SIDE_TINT = { instruction: tints.instruction, testing: tints.testing } as const

function atomItems(lesson: Lesson, row: number) {
  return rowLesson(lesson, { row, set: 1 }, 'atom').items
}

function sideItems(lesson: Lesson, row: number, side: (typeof KINDS)[number]) {
  return atomItems(lesson, row).filter((it) => it.role === KIND_ROLE[side])
}

type ActiveBlock = SessionState['blocks'][number] | null

function liveRowOf(playing: boolean, activeBlock: ActiveBlock): number | null {
  if (!playing) return null
  return activeBlock?.plan.rows[0]?.row ?? null
}

function liveSideOf(activeBlock: ActiveBlock): 'instruction' | 'testing' | null {
  const kind = activeBlock?.plan.kind
  if (kind === 'review') return 'testing'
  if (kind !== 'atom') return null
  const current = activeBlock?.current
  if (current === null || current === undefined) return null
  const served = current.lesson.items[current.state.current?.item ?? 0]
  return served?.role === 'model' ? 'instruction' : 'testing'
}

const s = stylex.create({
  devdock: {
    position: 'fixed',
    bottom: '92px',
    left: '16px',
    right: '16px',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    paddingBlock: '11px',
    paddingInline: '14px',
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
  devgrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
    gap: '4px',
    maxHeight: '144px',
    overflowY: 'auto',
  },
  devatom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    paddingInline: '3px',
    paddingBlock: '2px',
    borderRadius: '9px',
  },
  devatomOpen: {
    backgroundColor: `color-mix(in srgb, ${t.ink} 9%, transparent)`,
  },
  devrun: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '3px',
  },
  devstrip: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    minHeight: '27px',
    paddingTop: '8px',
    borderTopWidth: '2px',
    borderTopStyle: 'solid',
    borderTopColor: `color-mix(in srgb, ${t.ink} 12%, transparent)`,
  },
  devstripGlyph: {
    fontSize: '12px',
    lineHeight: 1,
    color: `color-mix(in srgb, ${t.ink} 45%, transparent)`,
  },
  devatomCode: {
    appearance: 'none',
    margin: 0,
    padding: 0,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    fontFamily: t.sans,
    fontSize: '12.5px',
    fontWeight: 750,
    letterSpacing: '-0.01em',
    color: { default: `color-mix(in srgb, ${t.ink} 60%, transparent)`, ':hover': t.ink },
    cursor: 'pointer',
  },
  devatomCodeFirm: {
    color: t.ink,
  },
  devjump: {
    appearance: 'none',
    fontSize: '11px',
    lineHeight: 1,
    width: '24px',
    height: '22px',
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

function AtomChip({
  lesson,
  row,
  code,
  firmed,
  open,
  dim,
  onOpen,
  onJump,
}: {
  lesson: Lesson
  row: number
  code: string
  firmed: boolean
  open: boolean
  dim: boolean
  onOpen: () => void
  onJump: (kind: 'instruction' | 'testing') => void
}) {
  return (
    <div {...stylex.props(s.devatom, open && s.devatomOpen)}>
      <button
        {...stylex.props(s.devatomCode, firmed && s.devatomCodeFirm)}
        onClick={onOpen}
        aria-label={`atom ${code} items`}
        aria-expanded={open}
        title={`atom ${code}`}
      >
        {code}
      </button>
      {KINDS.map((kind) => {
        if (sideItems(lesson, row, kind).length === 0) return null
        return (
          <button
            key={kind}
            {...stylex.props(s.devjump, tintVars.tint, SIDE_TINT[kind], dim && s.devjumpDim)}
            onClick={() => onJump(kind)}
            data-cuelume-press="tick"
            aria-label={`atom ${code} ${KIND_WORD[kind]}`}
            title={`${code} · ${KIND_LABEL[kind]}`}
          >
            {KIND_GLYPH[kind]}
          </button>
        )
      })}
    </div>
  )
}

function ItemStrip({
  lesson,
  row,
  code,
  side,
  atItem,
  anyNow,
  onJump,
}: {
  lesson: Lesson
  row: number
  code: string
  side: 'instruction' | 'testing' | null
  atItem: number | null
  anyNow: boolean
  onJump: (kind: 'instruction' | 'testing', item: number) => void
}) {
  return (
    <div {...stylex.props(s.devstrip)}>
      <span {...stylex.props(s.devdockHead)}>atom {code}</span>
      {KINDS.map((kind) => {
        const pieces = sideItems(lesson, row, kind)
        const offset = kind === 'testing' ? atomItems(lesson, row).filter((it) => it.role === 'model').length : 0
        if (pieces.length === 0) return null
        return (
          <span key={kind} {...stylex.props(s.devrun)}>
            <span {...stylex.props(s.devstripGlyph)}>{KIND_GLYPH[kind]}</span>
            {pieces.map((piece, i) => {
              const nowDot = side === kind && atItem === offset + i
              return (
                <button
                  key={i}
                  {...stylex.props(
                    s.devjump,
                    s.devjumpDot,
                    tintVars.tint,
                    SIDE_TINT[kind],
                    nowDot && s.devjumpNow,
                    anyNow && !nowDot && s.devjumpDim,
                  )}
                  onClick={() => onJump(kind, i)}
                  data-cuelume-press="tick"
                  aria-label={`atom ${code} ${KIND_WORD[kind]} ${i + 1} of ${pieces.length}`}
                  title={`${i + 1} of ${pieces.length} · ${piece.prompt}`}
                />
              )
            })}
          </span>
        )
      })}
    </div>
  )
}

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
  const [picked, setPicked] = useState<number | null>(null)
  const storyNow = playing && activeBlock?.plan.kind === 'narrative'
  const anyNow = storyNow || (playing && atItem !== null)
  const live = liveRowOf(playing, activeBlock)
  const shown = picked ?? live ?? atomRows[0] ?? null
  const side = shown === live ? liveSideOf(activeBlock) : null

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
      <div {...stylex.props(s.devgrid)}>
        {atomRows.map((row) => (
          <AtomChip
            key={row}
            lesson={lesson}
            row={row}
            code={atomOf(row)}
            firmed={history?.get(row)?.firmed ?? false}
            open={row === shown}
            dim={anyNow}
            onOpen={() => setPicked(row)}
            onJump={(kind) => {
              setPicked(row)
              onJump(row, Date.now(), kind)
            }}
          />
        ))}
      </div>
      {shown !== null && (
        <ItemStrip
          lesson={lesson}
          row={shown}
          code={atomOf(shown)}
          side={side}
          atItem={atItem}
          anyNow={anyNow}
          onJump={(kind, item) => onJump(shown, Date.now(), kind, item)}
        />
      )}
    </aside>
  )
}
