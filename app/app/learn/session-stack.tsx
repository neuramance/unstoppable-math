import * as stylex from '@stylexjs/stylex'
import { t } from '@/app/tokens.stylex'
import type { SessionPlan } from '@/lib/session'
import { BLOCK_GLYPH, BLOCK_LABEL, KIND_TINT, tintVars } from './session-blocks'
import { BlockSmash } from './session-smash'
import type { Phase } from './use-session-phase'

const STACK_REGISTER = {
  stackTitle: 'This session',
  stackHint: 'Your blocks will drop in here',
  now: 'now',
  blockSub: (atoms: string[]) => `${atoms.length === 1 ? 'atom' : 'atoms'} ${atoms.join(', ')}`,
  narrativeSub: 'the fractions story',
  blockOf: (m: number, n: number) => `block ${m} of ${n}`,
  blocksAhead: (n: number) => `${n} blocks`,
  complete: 'complete',
  progress: (firm: number, total: number) => `${firm} of ${total} atoms firm`,
}

const STRIDE = 78

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

const s = stylex.create({
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
    overflow: 'hidden',
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
    transitionProperty: 'background-color, border-color',
    transitionDuration: '0.2s',
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
})

export function StackCard({
  plan,
  phase,
  shown,
  entrance,
  firmCount,
  totalRows,
  atomOf,
}: {
  plan: SessionPlan
  phase: Phase
  shown: number
  entrance: 'drop' | 'step'
  firmCount: number
  totalRows: number
  atomOf: (row: number) => string
}) {
  const smashing = phase === 'crack' || phase === 'shatter'
  const stacked = phase === 'dropping' || phase === 'active' || smashing
  const meta =
    phase === 'done'
      ? STACK_REGISTER.complete
      : stacked
        ? STACK_REGISTER.blockOf(Math.min(shown + 1, plan.blocks.length), plan.blocks.length)
        : STACK_REGISTER.blocksAhead(plan.blocks.length)

  return (
    <div {...stylex.props(s.sesscard)}>
      <div {...stylex.props(s.sesshead)}>
        <p {...stylex.props(s.sesstitle)}>{STACK_REGISTER.stackTitle}</p>
        <p {...stylex.props(s.sessmeta)}>{meta}</p>
      </div>
      <div
        {...stylex.props(s.sessdots)}
        role="progressbar"
        aria-label={STACK_REGISTER.stackTitle}
        aria-valuemin={0}
        aria-valuemax={plan.blocks.length}
        aria-valuenow={phase === 'done' ? plan.blocks.length : Math.min(shown, plan.blocks.length)}
      >
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
        {phase === 'idle' && <p {...stylex.props(s.hint)}>{STACK_REGISTER.stackHint}</p>}
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
                  tintVars.tint,
                  KIND_TINT[b.kind],
                  anim,
                  s.top((3 - lift) * STRIDE),
                  entrance === 'drop' && s.delay(`${lift * 0.11}s`),
                )}
              >
                <span {...stylex.props(s.glyph)} aria-hidden="true">
                  {BLOCK_GLYPH[b.kind]}
                </span>
                <div {...stylex.props(s.blockBody)}>
                  <b {...stylex.props(s.blockTitle)}>{BLOCK_LABEL[b.kind]}</b>
                  <span {...stylex.props(s.blockSub)}>
                    {b.kind === 'narrative'
                      ? STACK_REGISTER.narrativeSub
                      : STACK_REGISTER.blockSub(b.rows.map((r) => atomOf(r.row)))}
                  </span>
                </div>
                {lift === 0 && phase !== 'dropping' && <span {...stylex.props(s.blockNow)}>{STACK_REGISTER.now}</span>}
              </div>
            )
          })}
        {smashing && (
          <BlockSmash cracking={phase === 'crack'} kind={plan.blocks[shown]?.kind ?? 'atom'} topPx={3 * STRIDE} />
        )}
      </div>
      <p {...stylex.props(s.sessfirm)}>{STACK_REGISTER.progress(firmCount, totalRows)}</p>
    </div>
  )
}
