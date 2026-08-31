import * as stylex from '@stylexjs/stylex'
import { t } from '@/app/tokens.stylex'
import type { BlockKind } from '@/lib/session'
import { KIND_TINT, tintVars } from './session-blocks'

const SHARD_CLIPS = [
  'polygon(0% 0%, 30% 0%, 44% 20%, 54% 46%, 22% 52%, 0% 55%)',
  'polygon(30% 0%, 70% 0%, 62% 24%, 54% 46%, 44% 20%)',
  'polygon(70% 0%, 100% 0%, 100% 40%, 78% 44%, 54% 46%, 62% 24%)',
  'polygon(100% 40%, 100% 100%, 65% 100%, 60% 70%, 54% 46%, 78% 44%)',
  'polygon(65% 100%, 25% 100%, 34% 74%, 54% 46%, 60% 70%)',
  'polygon(25% 100%, 0% 100%, 0% 55%, 22% 52%, 54% 46%, 34% 74%)',
]

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

const s = stylex.create({
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
  top: (px: number) => ({ top: `${px}px` }),
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
})

const CRACKS = [s.crack1, s.crack2, s.crack3, s.crack4, s.crack5, s.crack6]
const SHATS = [s.shat1, s.shat2, s.shat3, s.shat4, s.shat5, s.shat6]

export function BlockSmash({ cracking, kind, topPx }: { cracking: boolean; kind: BlockKind; topPx: number }) {
  return (
    <div {...stylex.props(s.smash, cracking && s.smashCrack, tintVars.tint, KIND_TINT[kind], s.top(topPx))}>
      {SHARD_CLIPS.map((clip, i) => (
        <div key={i} {...stylex.props(s.shard, s.clip(clip), cracking ? CRACKS[i] : SHATS[i])} />
      ))}
      {!cracking && [s.dust0, s.dust1, s.dust2, s.dust3].map((at, i) => <div key={i} {...stylex.props(s.dust, at)} />)}
    </div>
  )
}
