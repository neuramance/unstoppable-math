/* eslint-disable react-hooks/set-state-in-effect */

import * as stylex from '@stylexjs/stylex'
import { play } from 'cuelume'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '@/app/tokens.stylex'
import type { Lesson, TrialEntry } from '@/lib/lesson'
import { cueAt, parseNarrativeCues, type NarrativeCue } from '@/lib/narrative'
import {
  jumpToRow,
  planSession,
  rowLesson,
  replayLog,
  replaySession,
  type BlockKind,
  type LogAudit,
  type RowHistory,
  type SessionLog,
  type SessionPlan,
  type SessionState,
  type Trial,
} from '@/lib/session'
import { activeId, removeItem, writeItem } from '@/lib/store'
import { chrome } from './chrome'
import { LessonPlayer } from './teach'
import { EnterKey, shellInert } from './ui'

export const REGISTER = {
  eyebrow: 'Today · fractions',
  heroTitle: 'Ready to break some blocks?',
  heroSub: (blocks: number) =>
    `Your session is a stack of ${blocks} short blocks. Clear one, smash it, and the next drops down.`,
  begin: 'Begin session',
  stackTitle: 'This session',
  stackHint: 'Your blocks will drop in here',
  now: 'now',
  blockLabel: {
    narrative: 'Narrative',
    instruction: 'Instruction',
    testing: 'Checking',
    review: 'Review',
  } as Record<BlockKind, string>,
  blockGlyph: { narrative: '▶', instruction: '★', testing: '✎', review: '↻' } as Record<BlockKind, string>,
  blockSub: (atoms: string[]) => `${atoms.length === 1 ? 'atom' : 'atoms'} ${atoms.join(', ')}`,
  narrativeSub: 'the fractions story',
  narrativePlay: 'Tap to start the story',
  narrativeSkip: 'Skip',
  blockOf: (m: number, n: number) => `block ${m} of ${n}`,
  blocksAhead: (n: number) => `${n} blocks`,
  complete: 'complete',
  progress: (firm: number, total: number) => `${firm} of ${total} atoms firm`,
  doneTitle: 'Stack cleared!',
  doneLine: 'You smashed every block. Come back tomorrow and keep your atoms firm.',
  partialTitle: 'Stack done!',
  partialLine: (left: number) =>
    `${left === 1 ? 'One block comes' : `${left} blocks come`} back tomorrow with fresh numbers, so you can make ${left === 1 ? 'that atom' : 'those atoms'} firm. The rest is yours.`,
  stats: { blocks: 'blocks cleared', firstTry: 'first try', rows: 'atoms firmed', minutes: 'minutes' },
  finish: 'Done',
  staleTag: ' · lesson updated',
  staleNote:
    'Some of these questions changed since your last visit, so those atoms come back for another pass. Everything you kept firm stays firm.',
  resetTag: ' · progress reset',
  resetNote: 'Your saved progress would not load, so this stack starts from the top.',
}

const SHARD_CLIPS = [
  'polygon(0% 0%, 30% 0%, 44% 20%, 54% 46%, 22% 52%, 0% 55%)',
  'polygon(30% 0%, 70% 0%, 62% 24%, 54% 46%, 44% 20%)',
  'polygon(70% 0%, 100% 0%, 100% 40%, 78% 44%, 54% 46%, 62% 24%)',
  'polygon(100% 40%, 100% 100%, 65% 100%, 60% 70%, 54% 46%, 78% 44%)',
  'polygon(65% 100%, 25% 100%, 34% 74%, 54% 46%, 60% 70%)',
  'polygon(25% 100%, 0% 100%, 0% 55%, 22% 52%, 54% 46%, 34% 74%)',
]
const STRIDE = 78

const OKLCH = '@supports (color: oklch(from red l c h))'
const WIDE = '@media (min-width: 1048px)'
const NARROW = '@media (max-width: 760px)'

const rise = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(16px)' },
})

const sessDrop = stylex.keyframes({
  '0%': { transform: 'translateY(-340px)', animationTimingFunction: 'cubic-bezier(0.5, 0, 1, 1)' },
  '55%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0, 0, 0.45, 1)' },
  '71%': { transform: 'translateY(-22px)', animationTimingFunction: 'cubic-bezier(0.5, 0, 1, 1)' },
  '84%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0, 0, 0.5, 1)' },
  '93%': { transform: 'translateY(-7px)' },
  '100%': { transform: 'translateY(0)' },
})

const sessSettle = stylex.keyframes({
  '0%': { transform: 'translateY(-78px)', animationTimingFunction: 'cubic-bezier(0.55, 0, 1, 1)' },
  '62%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0, 0, 0.5, 1)' },
  '80%': { transform: 'translateY(-8px)', animationTimingFunction: 'cubic-bezier(0.5, 0, 1, 1)' },
  '100%': { transform: 'translateY(0)' },
})

const sessFall = stylex.keyframes({
  '0%': { transform: 'translateY(-340px)', animationTimingFunction: 'cubic-bezier(0.5, 0, 1, 1)' },
  '60%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0, 0, 0.45, 1)' },
  '76%': { transform: 'translateY(-18px)', animationTimingFunction: 'cubic-bezier(0.5, 0, 1, 1)' },
  '90%': { transform: 'translateY(0)' },
  '96%': { transform: 'translateY(-5px)' },
  '100%': { transform: 'translateY(0)' },
})

const sessJolt = stylex.keyframes({
  '0%': { transform: 'translate(0, 0) rotate(0deg)' },
  '30%': { transform: 'translate(-3px, 2px) rotate(-1deg)' },
  '60%': { transform: 'translate(3px, -1px) rotate(1deg)' },
  '100%': { transform: 'translate(0, 0) rotate(0deg)' },
})

const sessCrack1 = stylex.keyframes({ to: { transform: 'translate(-3px, -2px) rotate(-0.8deg)' } })
const sessCrack2 = stylex.keyframes({ to: { transform: 'translate(0, -3px) rotate(0.5deg)' } })
const sessCrack3 = stylex.keyframes({ to: { transform: 'translate(3px, -2px) rotate(1deg)' } })
const sessCrack4 = stylex.keyframes({ to: { transform: 'translate(3px, 2px) rotate(0.7deg)' } })
const sessCrack5 = stylex.keyframes({ to: { transform: 'translate(0, 3px) rotate(-0.5deg)' } })
const sessCrack6 = stylex.keyframes({ to: { transform: 'translate(-3px, 2px) rotate(-1deg)' } })

const sessShat1 = stylex.keyframes({
  '0%': { transform: 'translate(-3px, -2px) rotate(-0.8deg)', opacity: 1 },
  '40%': { transform: 'translate(-62px, -36px) rotate(-18deg)', opacity: 1 },
  '100%': { transform: 'translate(-104px, 190px) rotate(-42deg)', opacity: 0 },
})

const sessShat2 = stylex.keyframes({
  '0%': { transform: 'translate(0, -3px) rotate(0.5deg)', opacity: 1 },
  '40%': { transform: 'translate(-6px, -54px) rotate(10deg)', opacity: 1 },
  '100%': { transform: 'translate(9px, 182px) rotate(26deg)', opacity: 0 },
})

const sessShat3 = stylex.keyframes({
  '0%': { transform: 'translate(3px, -2px) rotate(1deg)', opacity: 1 },
  '40%': { transform: 'translate(65px, -42px) rotate(20deg)', opacity: 1 },
  '100%': { transform: 'translate(110px, 185px) rotate(46deg)', opacity: 0 },
})

const sessShat4 = stylex.keyframes({
  '0%': { transform: 'translate(3px, 2px) rotate(0.7deg)', opacity: 1 },
  '40%': { transform: 'translate(51px, -11px) rotate(14deg)', opacity: 1 },
  '100%': { transform: 'translate(87px, 197px) rotate(31deg)', opacity: 0 },
})

const sessShat5 = stylex.keyframes({
  '0%': { transform: 'translate(0, 3px) rotate(-0.5deg)', opacity: 1 },
  '45%': { transform: 'translate(-9px, -6px) rotate(-8deg)', opacity: 1 },
  '100%': { transform: 'translate(-14px, 202px) rotate(-19deg)', opacity: 0 },
})

const sessShat6 = stylex.keyframes({
  '0%': { transform: 'translate(-3px, 2px) rotate(-1deg)', opacity: 1 },
  '40%': { transform: 'translate(-50px, -9px) rotate(-15deg)', opacity: 1 },
  '100%': { transform: 'translate(-91px, 194px) rotate(-36deg)', opacity: 0 },
})

const sessDust = stylex.keyframes({
  '0%': { transform: 'translate(0, 0) scale(0.4)', opacity: 0.9 },
  '100%': { transform: 'translate(var(--dx, 0), -26px) scale(1.3)', opacity: 0 },
})

const sessConf = stylex.keyframes({
  '0%': { transform: 'translateY(-30px) rotate(0deg)', opacity: 1 },
  '100%': { transform: 'translateY(260px) rotate(320deg)', opacity: 0 },
})

const sessPop = stylex.keyframes({
  '0%': { transform: 'scale(0.4)', opacity: 0 },
  '70%': { transform: 'scale(1.1)' },
  '100%': { transform: 'scale(1)', opacity: 1 },
})

const tints = stylex.create({
  narrative: { '--sessc': `color-mix(in srgb, rgba(255,150,50,1) 85%, ${t.void})` },
  instruction: { '--sessc': `color-mix(in srgb, rgba(53,143,243,1) 85%, ${t.void})` },
  testing: { '--sessc': `color-mix(in srgb, rgba(40,210,110,1) 85%, ${t.void})` },
})

const KIND_TINT: Record<BlockKind, (typeof tints)[keyof typeof tints]> = {
  narrative: tints.narrative,
  instruction: tints.instruction,
  testing: tints.testing,
  review: tints.testing,
}

const s = stylex.create({
  sess: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '34px',
    width: '100%',
    maxWidth: { default: '1040px', [WIDE]: '1196px' },
    marginBlock: 0,
    marginInline: 'auto',
    flexDirection: { default: 'row', [NARROW]: 'column' },
  },
  sessWithDock: {
    paddingBottom: '344px',
  },
  sessaside: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: { default: '280px', [NARROW]: 'auto' },
    width: { default: null, [NARROW]: '100%' },
    minWidth: 0,
    zoom: { default: null, [WIDE]: 1.15 },
  },
  sessmain: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    zoom: { default: null, [WIDE]: 1.15 },
  },
  sesscard: {
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 24%, transparent)`,
    borderRadius: '18px',
    padding: '18px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 3%, transparent)`,
    boxShadow: `0 5px 0 color-mix(in srgb, ${t.ink} 8%, transparent)`,
  },
  sesshead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '10px',
  },
  sesstitle: {
    fontSize: '16px',
    fontWeight: 750,
    letterSpacing: '-0.01em',
  },
  sessmeta: {
    fontFamily: t.mono,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: t.mut,
  },
  sessfirm: {
    fontFamily: t.mono,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: t.mut,
    marginTop: '14px',
    textAlign: 'center',
  },
  sessdots: {
    display: 'flex',
    gap: '5px',
    marginBottom: '16px',
  },
  sessdot: {
    height: '8px',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    borderRadius: '4px',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 20%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${t.ink} 6%, transparent)`,
    transitionProperty: 'background-color',
    transitionDuration: '0.4s',
    transitionTimingFunction: 'ease',
  },
  sessdotDone: {
    backgroundColor: t.accent,
    borderColor: `color-mix(in srgb, ${t.accent} 55%, ${t.ink})`,
  },
  sessdotOn: {
    backgroundColor: `color-mix(in srgb, ${t.ink} 45%, transparent)`,
    borderColor: `color-mix(in srgb, ${t.ink} 60%, transparent)`,
  },
  stack: {
    position: 'relative',
    height: '298px',
  },
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '64px',
    borderWidth: '2.5px',
    borderStyle: 'dashed',
    borderColor: `color-mix(in srgb, ${t.ink} 22%, transparent)`,
    borderRadius: '14px',
  },
  hint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    paddingBlock: 0,
    paddingInline: '28px',
    color: t.mut,
    fontSize: '12.5px',
  },
  top: (px: number) => ({ top: `${px}px` }),
  tint: {
    '--sessrim': {
      default: `color-mix(in srgb, var(--sessc) 50%, ${t.ink})`,
      [OKLCH]: 'oklch(from var(--sessc) calc(l - 0.15) c h)',
    },
    '--sessline': {
      default: `color-mix(in srgb, ${t.ink} 70%, transparent)`,
      [OKLCH]: 'oklch(from var(--sessc) 0.26 calc(c * 0.55) h)',
    },
    '--sesson': {
      default: t.void,
      [OKLCH]: 'oklch(from var(--sessc) 0.97 calc(c * 0.12) h)',
    },
  },
  block: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    paddingBlock: 0,
    paddingInline: '12px',
    borderWidth: '2.5px',
    borderStyle: 'solid',
    borderColor: 'var(--sessline)',
    borderRadius: '14px',
    backgroundColor: 'var(--sessc)',
    color: 'var(--sesson)',
    boxShadow: '0 4px 0 var(--sessrim)',
  },
  glyph: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    backgroundColor: 'color-mix(in srgb, var(--sessline) 26%, transparent)',
    fontSize: '17px',
  },
  blockBody: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
  },
  blockTitle: {
    display: 'block',
    fontSize: '15.5px',
    fontWeight: 750,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  blockSub: {
    display: 'block',
    fontFamily: t.mono,
    fontSize: '12px',
    fontWeight: 650,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'color-mix(in srgb, var(--sesson) 90%, transparent)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  blockNow: {
    fontFamily: t.mono,
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    backgroundColor: t.ink,
    color: t.void,
    borderRadius: '999px',
    paddingBlock: '4px',
    paddingInline: '10px',
    animationName: rise,
    animationDuration: '0.4s',
    animationTimingFunction: 'ease',
    animationFillMode: 'both',
  },
  drop: {
    animationName: sessDrop,
    animationDuration: '0.85s',
    animationTimingFunction: 'linear',
    animationFillMode: 'both',
  },
  settle: {
    animationName: sessSettle,
    animationDuration: '0.5s',
    animationTimingFunction: 'linear',
    animationFillMode: 'both',
  },
  fall: {
    animationName: sessFall,
    animationDuration: '0.6s',
    animationTimingFunction: 'linear',
    animationDelay: '0.1s',
    animationFillMode: 'both',
  },
  delay: (d: string) => ({ animationDelay: d }),
  smash: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '64px',
  },
  smashCrack: {
    animationName: sessJolt,
    animationDuration: '0.18s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  shard: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'var(--sessc)',
    borderWidth: '2.5px',
    borderStyle: 'solid',
    borderColor: 'var(--sessline)',
    borderRadius: '14px',
  },
  clip: (p: string) => ({ clipPath: p }),
  crack1: {
    animationName: sessCrack1,
    animationDuration: '0.14s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  crack2: {
    animationName: sessCrack2,
    animationDuration: '0.14s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  crack3: {
    animationName: sessCrack3,
    animationDuration: '0.14s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  crack4: {
    animationName: sessCrack4,
    animationDuration: '0.14s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  crack5: {
    animationName: sessCrack5,
    animationDuration: '0.14s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  crack6: {
    animationName: sessCrack6,
    animationDuration: '0.14s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  shat1: {
    animationName: sessShat1,
    animationDuration: '0.55s',
    animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
    animationFillMode: 'both',
  },
  shat2: {
    animationName: sessShat2,
    animationDuration: '0.55s',
    animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
    animationDelay: '0.012s',
    animationFillMode: 'both',
  },
  shat3: {
    animationName: sessShat3,
    animationDuration: '0.55s',
    animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
    animationDelay: '0.024s',
    animationFillMode: 'both',
  },
  shat4: {
    animationName: sessShat4,
    animationDuration: '0.55s',
    animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
    animationDelay: '0.036s',
    animationFillMode: 'both',
  },
  shat5: {
    animationName: sessShat5,
    animationDuration: '0.55s',
    animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
    animationDelay: '0.048s',
    animationFillMode: 'both',
  },
  shat6: {
    animationName: sessShat6,
    animationDuration: '0.55s',
    animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
    animationDelay: '0.06s',
    animationFillMode: 'both',
  },
  dust: {
    position: 'absolute',
    bottom: '-3px',
    width: '9px',
    height: '9px',
    borderRadius: '999px',
    backgroundColor: `color-mix(in srgb, ${t.ink} 28%, transparent)`,
    animationName: sessDust,
    animationDuration: '0.5s',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  dust0: { left: '28%', '--dx': '-52px' },
  dust1: { left: '48%', '--dx': '-18px' },
  dust2: { left: '68%', '--dx': '26px' },
  dust3: { left: '88%', '--dx': '60px' },
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
      [OKLCH]: 'oklch(from var(--sessc) calc(l - 0.15) c h)',
    },
    '--sessline': {
      default: `color-mix(in srgb, ${t.ink} 70%, transparent)`,
      [OKLCH]: 'oklch(from var(--sessc) 0.26 calc(c * 0.55) h)',
    },
    '--sesson': {
      default: t.void,
      [OKLCH]: 'oklch(from var(--sessc) 0.97 calc(c * 0.12) h)',
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
  stage: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    backgroundColor: '#0b0b0c',
    '--film-h': 'min(100vh, 75vw)',
    '--film-w': 'min(100vw, 133.3333vh)',
  },
  film: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  cap: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc((100vh - var(--film-h)) / 2 + var(--film-h) * 0.0667)',
    width: 'calc(var(--film-w) * 0.7292)',
    margin: 0,
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 'max(15px, calc(var(--film-h) * 0.0389))',
    lineHeight: 1.24,
    letterSpacing: '-0.005em',
    color: '#fcfcfc',
    WebkitTextStrokeWidth: 'max(2px, calc(var(--film-h) * 0.00556))',
    WebkitTextStrokeColor: 'rgba(0, 0, 0, 0.62)',
    paintOrder: 'stroke fill',
    filter: 'drop-shadow(0 4px 18px rgba(0, 0, 0, 0.45))',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  capLine: {
    display: 'block',
  },
  skip: {
    position: 'absolute',
    right: 'max(1.25rem, env(safe-area-inset-right))',
    bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
    paddingBlock: '0.55rem',
    paddingInline: '1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: 'rgba(255, 255, 255, 0.28)', ':hover': 'rgba(255, 255, 255, 0.55)' },
    borderRadius: '999px',
    backgroundColor: 'rgba(8, 10, 14, 0.45)',
    backdropFilter: 'blur(6px)',
    color: { default: 'rgba(255, 255, 255, 0.82)', ':hover': '#fff' },
    fontFamily: 'inherit',
    fontStyle: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  playBtn: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    paddingBlock: '0.6rem',
    paddingInline: '1.1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${t.ink} 28%, transparent)`,
    borderRadius: '999px',
    backgroundColor: `color-mix(in srgb, ${t.void} 55%, transparent)`,
    backdropFilter: 'blur(6px)',
    color: t.ink,
    fontFamily: 'inherit',
    fontStyle: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    fontSize: '0.82rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
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

const CRACKS = [s.crack1, s.crack2, s.crack3, s.crack4, s.crack5, s.crack6]
const SHATS = [s.shat1, s.shat2, s.shat3, s.shat4, s.shat5, s.shat6]

function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const EXIT_GRACE_MS = 900
const SETTLE_MS = 450

function cueUrl(file: string): string {
  return `/videos/${file.replace(/\.mp4$/, '')}.cues.json`
}

async function goFullscreen(stage: HTMLElement | null): Promise<void> {
  if (stage === null || document.fullscreenElement !== null) return
  try {
    await stage.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    return
  }
}

function nudgeLayout(): void {
  void document.body.offsetHeight
  window.dispatchEvent(new Event('resize'))
}

async function leaveFullscreen(stage: HTMLElement | null): Promise<void> {
  if (stage === null || document.fullscreenElement !== stage) return
  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      document.removeEventListener('fullscreenchange', done)
      resolve()
    }
    document.addEventListener('fullscreenchange', done)
    window.setTimeout(done, EXIT_GRACE_MS)
    document.exitFullscreen().catch(done)
  })

  await new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS))

  if (document.fullscreenElement !== null) {
    await document.exitFullscreen().catch(() => undefined)
    await new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS))
  }

  nudgeLayout()
}

function NarrativeFilm({ file, auto, dev, onDone }: { file: string; auto: boolean; dev: boolean; onDone: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const vidRef = useRef<HTMLVideoElement>(null)
  const [cues, setCues] = useState<readonly NarrativeCue[]>([])
  const [cue, setCue] = useState<NarrativeCue | null>(null)
  const [needsStart, setNeedsStart] = useState(reduced)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(cueUrl(file), { signal: controller.signal })
        if (!response.ok) throw new Error(`captions answered ${response.status}`)
        const parsed = parseNarrativeCues(await response.json())
        if (parsed.film !== file) throw new Error(`captions are for ${parsed.film}, not ${file}`)
        setCues(parsed.cues)
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn(`[narrative] no captions for ${file}`, error)
      }
    })()
    return () => controller.abort()
  }, [file])

  useEffect(() => {
    const video = vidRef.current
    if (video === null || cues.length === 0) return
    let shown = -1
    let frame = 0
    const tick = () => {
      const next = cueAt(cues, video.currentTime)
      if ((next?.index ?? -1) !== shown) {
        shown = next?.index ?? -1
        setCue(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [cues])

  useEffect(() => {
    const stage = stageRef.current
    if (reduced()) return () => void leaveFullscreen(stage)
    void goFullscreen(stage)
    void vidRef.current
      ?.play()
      .then(() => setNeedsStart(false))
      .catch(() => setNeedsStart(true))
    return () => void leaveFullscreen(stage)
  }, [])

  const finish = async () => {
    await leaveFullscreen(stageRef.current)
    doneRef.current()
  }

  useEffect(() => {
    if (!auto) return
    const t = setTimeout(() => void finish(), 130)
    return () => clearTimeout(t)
  })

  return createPortal(
    <div {...stylex.props(s.stage)} ref={stageRef}>
      <video
        ref={vidRef}
        {...stylex.props(s.film)}
        src={`/videos/${file}`}
        playsInline
        preload="auto"
        onEnded={() => void finish()}
        onError={() => void finish()}
      />
      {cue !== null && (
        <p {...stylex.props(s.cap)}>
          {cue.lines.map((line, i) => (
            <span {...stylex.props(s.capLine)} key={i}>
              {line}
            </span>
          ))}
        </p>
      )}
      {dev && (
        <button {...stylex.props(s.skip)} type="button" onClick={() => void finish()} data-cuelume-press="tick">
          {REGISTER.narrativeSkip}
        </button>
      )}
      {needsStart && (
        <button
          {...stylex.props(s.playBtn)}
          type="button"
          onClick={() => {
            void goFullscreen(stageRef.current)
            void vidRef.current
              ?.play()
              .then(() => setNeedsStart(false))
              .catch(() => undefined)
          }}
          data-cuelume-press="tick"
        >
          {REGISTER.narrativePlay}
        </button>
      )}
    </div>,
    document.body,
  )
}

const store = (topic: string) => `um.session.${topic}:${activeId()}`

function loadLog(key: string): { log: SessionLog | null; unreadable: boolean } {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return { log: null, unreadable: false }
  }
  if (!raw) return { log: null, unreadable: false }
  try {
    return { log: JSON.parse(raw) as SessionLog, unreadable: false }
  } catch {
    return { log: null, unreadable: true }
  }
}

const NO_HISTORY: RowHistory = new Map()

function saveLog(key: string, log: SessionLog | null) {
  if (log === null) void removeItem(key)
  else writeItem(key, JSON.stringify(log))
}

function parkLog(key: string) {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) writeItem(`${key}.unreadable`, raw)
  } catch {
    return
  }
}

function emptyAudit(): LogAudit {
  return {
    history: new Map(),
    staleRows: [],
    droppedRows: [],
    lostRows: [],
    droppedTrials: 0,
    unreadableSessions: 0,
    unstamped: false,
  }
}

function firstTryPct(right: number, graded: number): number {
  console.assert(graded >= 1)
  console.assert(right >= 0)
  return Math.round((100 * right) / graded)
}

type Phase = 'idle' | 'dropping' | 'active' | 'crack' | 'shatter' | 'done'

export function Session({ lesson, dev, onExit }: { lesson: Lesson; dev: boolean; onExit: () => void }) {
  const [key] = useState(() => store(lesson.topic))
  const [stored] = useState(() => loadLog(key))
  const [log, setLog] = useState<SessionLog | null>(stored.log)
  const [auto, setAuto] = useState(false)
  const [ui, setUi] = useState<{ phase: Phase; shown: number; mode?: 'drop' | 'step' } | null>(null)

  const [wiped, setWiped] = useState(false)

  const audit: LogAudit | null = useMemo(() => {
    if (log === null) return emptyAudit()
    try {
      return replayLog(lesson, log)
    } catch {
      return null
    }
  }, [lesson, log])
  const history = audit?.history ?? null

  const live = useMemo(() => {
    if (!log) return null
    let idx = -1
    for (let i = log.length - 1; i >= 0; i--)
      if (log[i].kind === 'start') {
        idx = i
        break
      }
    if (idx < 0) return null
    const start = log[idx] as { kind: 'start'; plan: SessionPlan }
    const trials: Trial[] = []
    for (const ev of log.slice(idx + 1)) if (ev.kind === 'trial') trials.push({ typed: ev.typed, at: ev.at })
    return { plan: start.plan, starts: log.filter((e) => e.kind === 'start').length, trials }
  }, [log])

  const session = useMemo((): SessionState | null => {
    if (!live) return null
    try {
      const st = replaySession(lesson, live.plan, live.trials)
      return st.staleAt === null ? st : null
    } catch {
      return null
    }
  }, [lesson, live])

  const broken = stored.unreadable || (log !== null && audit === null)
  useEffect(() => {
    if (!broken) return
    parkLog(key)
    saveLog(key, null)
    setLog(null)
    setUi(null)
    setWiped(true)
  }, [broken, key])

  const playing = session !== null && !session.done
  useEffect(() => {
    if (ui === null && playing && session) setUi({ phase: 'active', shown: session.blockIndex, mode: 'step' })
  }, [ui, playing, session])

  useEffect(() => {
    if (session === null && ui !== null) setUi(null)
  }, [session, ui])
  const phase = ui?.phase ?? (playing ? 'active' : 'idle')
  const shown = ui?.shown ?? (playing && session ? session.blockIndex : 0)

  const [previewedAt] = useState(() => Date.now())
  const preview = useMemo(() => planSession(lesson, history ?? NO_HISTORY, previewedAt), [lesson, history, previewedAt])
  const plan = phase === 'idle' ? preview : (live?.plan ?? preview)
  const atomRows = useMemo(() => [...new Set(lesson.items.map((it) => it.row))], [lesson])
  const atomOf = (row: number) => lesson.atoms?.[row] ?? String(row)
  const totalRows = atomRows.length
  const firmCount = useMemo(() => (history ? [...history.values()].filter((r) => r.firmed).length : 0), [history])

  const notice = wiped
    ? { tag: REGISTER.resetTag, note: REGISTER.resetNote }
    : (audit?.lostRows.length ?? 0) > 0
      ? { tag: REGISTER.staleTag, note: REGISTER.staleNote }
      : null

  const begin = () => {
    const fresh = planSession(lesson, history ?? NO_HISTORY, Date.now())
    const next: SessionLog = [...(log ?? []), { kind: 'start', plan: fresh }]
    saveLog(key, next)
    setLog(next)
    setUi({ phase: reduced() ? 'active' : 'dropping', shown: 0, mode: 'drop' })
  }

  const append = (entry: TrialEntry) => {
    const next: SessionLog = [...(log ?? []), { kind: 'trial', typed: entry.typed, at: Date.now() }]
    saveLog(key, next)
    setLog(next)
  }

  const jump = (row: number | null, now: number, kind: 'instruction' | 'testing' = 'instruction', item = 0) => {
    const { plan: fresh, trials } = jumpToRow(lesson, row, now, kind, item)
    const next: SessionLog = [
      ...(log ?? []),
      { kind: 'start', plan: fresh },
      ...trials.map((tr): SessionLog[number] => ({ kind: 'trial', ...tr })),
    ]
    saveLog(key, next)
    setLog(next)
    setUi(null)
  }

  useEffect(() => {
    if (phase !== 'dropping') return
    const timer = setTimeout(() => setUi({ phase: 'active', shown: 0, mode: 'drop' }), 1300)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'active' || !session) return
    if (!session.done && session.blockIndex === shown) return
    if (reduced()) {
      if (session.done) {
        play('ready')
        setUi({ phase: 'done', shown })
      } else setUi({ phase: 'active', shown: session.blockIndex, mode: 'step' })
      return
    }
    setUi({ phase: 'crack', shown })
  }, [phase, session, shown])

  useEffect(() => {
    if (phase !== 'crack') return
    const timer = setTimeout(() => setUi({ phase: 'shatter', shown }), 160)
    return () => clearTimeout(timer)
  }, [phase, shown])

  useEffect(() => {
    if (phase !== 'shatter' || !session) return
    const timer = setTimeout(() => {
      if (session.done) {
        play('ready')
        setUi({ phase: 'done', shown })
      } else setUi({ phase: 'active', shown: session.blockIndex, mode: 'step' })
    }, 660)
    return () => clearTimeout(timer)
  }, [phase, session, shown])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key !== 'Enter' || shellInert()) return
      if (phase === 'idle') {
        e.preventDefault()
        begin()
      } else if (phase === 'done') {
        e.preventDefault()
        onExit()
      } else if (phase === 'active' && session && !session.done) {
        if (session.blocks[session.blockIndex].plan.kind === 'narrative') {
          e.preventDefault()
          append({ typed: '' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const smashing = phase === 'crack' || phase === 'shatter'
  const stacked = phase === 'dropping' || phase === 'active' || smashing
  const activeBlock = playing && session ? session.blocks[session.blockIndex] : null
  const cur = activeBlock?.current ?? null
  const meta =
    phase === 'done'
      ? REGISTER.complete
      : stacked
        ? REGISTER.blockOf(Math.min(shown + 1, plan.blocks.length), plan.blocks.length)
        : REGISTER.blocksAhead(plan.blocks.length)
  const entrance = ui?.mode ?? 'step'

  const storyNow = playing && activeBlock?.plan.kind === 'narrative'
  const atItem = cur?.state.current?.item ?? null
  const anyNow = storyNow || (playing && activeBlock?.plan.kind !== 'narrative' && atItem !== null)
  const devPanel = dev && (
    <aside {...stylex.props(s.devdock, chrome.rise)}>
      <div {...stylex.props(s.devdockBar)}>
        <span {...stylex.props(s.devdockHead)}>navigator</span>
        <button
          {...stylex.props(s.devreset, auto && s.devresetOn)}
          aria-pressed={auto}
          onClick={() => setAuto(!auto)}
          data-cuelume-press="press"
        >
          {auto ? 'Stop autoplay' : 'Autoplay session'}
        </button>
        <button
          {...stylex.props(s.devreset)}
          onClick={() => {
            saveLog(key, null)
            setLog(null)
            setUi(null)
            setWiped(false)
          }}
          data-cuelume-press="press"
        >
          Reset history
        </button>
        {lesson.narrative && (
          <button
            {...stylex.props(
              s.devjump,
              s.tint,
              tints.narrative,
              storyNow && s.devjumpNow,
              anyNow && !storyNow && s.devjumpDim,
            )}
            onClick={() => jump(null, Date.now())}
            data-cuelume-press="tick"
            aria-label="story"
            title="story"
          >
            {REGISTER.blockGlyph.narrative}
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
                    {...stylex.props(s.devjump, s.tint, KIND_TINT[kind], anyNow && s.devjumpDim)}
                    onClick={() => jump(row, Date.now(), kind)}
                    data-cuelume-press="tick"
                    aria-label={`atom ${atomOf(row)} ${word}`}
                    title={`${atomOf(row)} · ${REGISTER.blockLabel[kind]}`}
                  >
                    {REGISTER.blockGlyph[kind]}
                  </button>
                  {pieces.map((piece, i) => {
                    const nowDot = side === kind && atItem === i
                    return (
                      <button
                        key={i}
                        {...stylex.props(
                          s.devjump,
                          s.devjumpDot,
                          s.tint,
                          KIND_TINT[kind],
                          nowDot && s.devjumpNow,
                          anyNow && !nowDot && s.devjumpDim,
                        )}
                        onClick={() => jump(row, Date.now(), kind, i)}
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

  return (
    <section {...stylex.props(s.sess, dev && s.sessWithDock)}>
      {devPanel}
      <aside {...stylex.props(s.sessaside, chrome.rise)}>
        <div {...stylex.props(s.sesscard)}>
          <div {...stylex.props(s.sesshead)}>
            <p {...stylex.props(s.sesstitle)}>{REGISTER.stackTitle}</p>
            <p {...stylex.props(s.sessmeta)}>{meta}</p>
          </div>
          <div {...stylex.props(s.sessdots)}>
            {plan.blocks.map((_, i) => (
              <span
                key={i}
                {...stylex.props(
                  s.sessdot,
                  (stacked || phase === 'done') &&
                    (i < shown || phase === 'done' ? s.sessdotDone : i === shown && s.sessdotOn),
                )}
              />
            ))}
          </div>
          <div {...stylex.props(s.stack)}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} {...stylex.props(s.slot, s.top(i * STRIDE))} />
            ))}
            {phase === 'idle' && <p {...stylex.props(s.hint)}>{REGISTER.stackHint}</p>}
            {stacked &&
              plan.blocks.map((b, i) => {
                if (i < shown || i > shown + 3) return null
                if (i === shown && smashing) return null
                const lift = i - shown
                const anim = entrance === 'drop' ? s.drop : lift === 3 ? s.fall : s.settle
                return (
                  <div
                    key={`${i}:${shown}`}
                    {...stylex.props(
                      s.block,
                      s.tint,
                      KIND_TINT[b.kind],
                      anim,
                      s.top((3 - lift) * STRIDE),
                      entrance === 'drop' && s.delay(`${lift * 0.11}s`),
                    )}
                  >
                    <span {...stylex.props(s.glyph)} aria-hidden="true">
                      {REGISTER.blockGlyph[b.kind]}
                    </span>
                    <div {...stylex.props(s.blockBody)}>
                      <b {...stylex.props(s.blockTitle)}>{REGISTER.blockLabel[b.kind]}</b>
                      <span {...stylex.props(s.blockSub)}>
                        {b.kind === 'narrative'
                          ? REGISTER.narrativeSub
                          : REGISTER.blockSub(b.rows.map((r) => atomOf(r.row)))}
                      </span>
                    </div>
                    {lift === 0 && phase !== 'dropping' && <span {...stylex.props(s.blockNow)}>{REGISTER.now}</span>}
                  </div>
                )
              })}
            {smashing && (
              <div
                {...stylex.props(
                  s.smash,
                  phase === 'crack' && s.smashCrack,
                  s.tint,
                  KIND_TINT[plan.blocks[shown]?.kind ?? 'testing'],
                  s.top(3 * STRIDE),
                )}
              >
                {SHARD_CLIPS.map((clip, i) => (
                  <div key={i} {...stylex.props(s.shard, s.clip(clip), phase === 'crack' ? CRACKS[i] : SHATS[i])} />
                ))}
                {phase === 'shatter' &&
                  [s.dust0, s.dust1, s.dust2, s.dust3].map((at, i) => <div key={i} {...stylex.props(s.dust, at)} />)}
              </div>
            )}
          </div>
          <p {...stylex.props(s.sessfirm)}>{REGISTER.progress(firmCount, totalRows)}</p>
        </div>
      </aside>
      <div {...stylex.props(s.sessmain, chrome.rise)}>
        {phase === 'idle' && (
          <section {...stylex.props(chrome.pintro)}>
            <p {...stylex.props(chrome.eyebrow, chrome.rise)}>
              {REGISTER.eyebrow}
              {notice?.tag}
            </p>
            <h1 {...stylex.props(chrome.h1, chrome.rise)}>{REGISTER.heroTitle}</h1>
            <p {...stylex.props(chrome.lede, chrome.rise)}>
              {REGISTER.heroSub(plan.blocks.length)}
              {notice ? ` ${notice.note}` : ''}
            </p>
            <button
              {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, chrome.rise)}
              onClick={begin}
              data-cuelume-press="press"
              data-cuelume-release="release"
            >
              {REGISTER.begin}
              <EnterKey />
            </button>
          </section>
        )}
        {phase === 'active' && activeBlock?.plan.kind === 'narrative' && lesson.narrative && (
          <NarrativeFilm
            key={live?.starts ?? 0}
            file={lesson.narrative}
            auto={auto}
            dev={dev}
            onDone={() => append({ typed: '' })}
          />
        )}
        {phase === 'active' && cur && (
          <LessonPlayer
            key={`${live?.starts ?? 0}:${session?.blockIndex ?? 0}:${cur.rowIndex}`}
            lesson={cur.lesson}
            log={cur.log}
            onTrial={append}
            auto={auto}
          />
        )}
        {phase === 'done' && session && (
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
              {session.cleared === session.blocks.length ? REGISTER.doneTitle : REGISTER.partialTitle}
            </h1>
            <p {...stylex.props(chrome.lede, chrome.rise)}>
              {session.cleared === session.blocks.length
                ? REGISTER.doneLine
                : REGISTER.partialLine(session.blocks.length - session.cleared)}
            </p>
            <div {...stylex.props(s.stats, chrome.rise)}>
              <div {...stylex.props(s.stat)}>
                <b {...stylex.props(s.statNum)}>{session.cleared}</b>
                <span {...stylex.props(s.statLabel)}>{REGISTER.stats.blocks}</span>
              </div>
              {session.graded > 0 && (
                <div {...stylex.props(s.stat)}>
                  <b {...stylex.props(s.statNum)}>{firstTryPct(session.rightFirstTry, session.graded)}%</b>
                  <span {...stylex.props(s.statLabel)}>{REGISTER.stats.firstTry}</span>
                </div>
              )}
              <div {...stylex.props(s.stat)}>
                <b {...stylex.props(s.statNum)}>{session.rowsFirmed.length}</b>
                <span {...stylex.props(s.statLabel)}>{REGISTER.stats.rows}</span>
              </div>
              <div {...stylex.props(s.stat)}>
                <b {...stylex.props(s.statNum)}>{Math.max(1, Math.round(session.activeMs / 60_000))}</b>
                <span {...stylex.props(s.statLabel)}>{REGISTER.stats.minutes}</span>
              </div>
            </div>
            <button
              {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, chrome.rise)}
              onClick={onExit}
              data-cuelume-press="press"
              data-cuelume-release="release"
            >
              {REGISTER.finish}
              <EnterKey />
            </button>
          </section>
        )}
      </div>
    </section>
  )
}
