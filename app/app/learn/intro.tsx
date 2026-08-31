import * as stylex from '@stylexjs/stylex'
import { useIntro } from './use-intro'

const markFormKf = stylex.keyframes({
  from: {
    transform: 'scale(0.26)',
    maskSize: '30% 90%',
    filter: 'blur(9px) brightness(0.16) contrast(1.6) saturate(0.15)',
  },
  '55%': {
    filter: 'blur(3px) brightness(0.7) contrast(1.2) saturate(0.7)',
  },
  to: {
    transform: 'scale(1)',
    maskSize: '400% 400%',
    filter: 'blur(0) brightness(1) contrast(1) saturate(1)',
  },
})

const settleKf = stylex.keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(-50%) scale(1.09)',
    filter: 'blur(13px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(-50%) scale(1)',
    filter: 'blur(0)',
  },
})

const throughKf = stylex.keyframes({
  from: {
    opacity: 1,
    transform: 'translateY(-50%) scale(1)',
    filter: 'blur(0)',
  },
  '55%': {
    opacity: 1,
    filter: 'blur(0)',
  },
  to: {
    opacity: 0,
    transform: 'translateY(-50%) scale(5.4)',
    filter: 'blur(9px)',
  },
})

const pulseKf = stylex.keyframes({
  '0%': { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.22)' },
  '50%': { boxShadow: '0 0 0 10px rgba(255, 255, 255, 0)' },
  '100%': { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.22)' },
})

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'

const s = stylex.create({
  video: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#05070c',
    transitionProperty: 'opacity, filter',
    transitionDuration: '760ms, 520ms',
    transitionTimingFunction: `${EASE_OUT}, ${EASE_OUT}`,
  },
  videoGone: {
    opacity: 0,
    pointerEvents: 'none',
  },
  videoFilter: (filter: string) => ({ filter }),
  title: {
    position: 'fixed',
    left: 0,
    right: 0,
    top: '50%',
    zIndex: 41,
    transform: 'translateY(-50%)',
    textAlign: 'center',
    pointerEvents: 'none',
    opacity: 0,
    transformOrigin: '50% 50%',
    willChange: 'transform, opacity, filter',
  },
  titleTop: (top: string) => ({ top }),
  titleIn: {
    animationName: settleKf,
    animationDuration: '820ms',
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'forwards',
  },
  titleThrough: {
    animationName: throughKf,
    animationDuration: '1500ms',
    animationTimingFunction: 'cubic-bezier(0.55, 0, 0.85, 0.35)',
    animationFillMode: 'forwards',
  },
  mark: {
    margin: 0,
  },
  markImg: {
    display: 'block',
    width: '70%',
    height: 'auto',
    marginBlock: 0,
    marginInline: 'auto',
    WebkitMaskImage: 'radial-gradient(ellipse 60% 100% at 50% 50%, #000 38%, rgba(0, 0, 0, 0) 78%)',
    maskImage: 'radial-gradient(ellipse 60% 100% at 50% 50%, #000 38%, rgba(0, 0, 0, 0) 78%)',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: '400% 400%',
  },
  markWidth: (width: string) => ({ width }),
  markForm: {
    animationName: markFormKf,
    animationDuration: '1150ms',
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'forwards',
  },
  tag: {
    marginTop: '1.4em',
    marginBottom: 0,
    marginInline: 0,
    color: '#ffffff',
    fontSize: 'clamp(0.72rem, 1.55vw, 1.6rem)',
    fontWeight: 500,
    letterSpacing: '0.005em',
    textShadow: '0 0.08em 0.5em rgba(0, 0, 0, 0.8)',
  },
  prompt: {
    position: 'fixed',
    left: '50%',
    bottom: '12%',
    zIndex: 43,
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingBlock: '0.7rem',
    paddingInline: '1.3rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: '999px',
    backgroundColor: 'rgba(8, 12, 20, 0.55)',
    backdropFilter: 'blur(8px)',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    letterSpacing: '0.02em',
    cursor: 'pointer',
    animationName: pulseKf,
    animationDuration: '2.6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    transitionProperty: 'opacity',
    transitionDuration: '420ms',
    transitionTimingFunction: EASE_OUT,
  },
  controls: {
    position: 'fixed',
    right: 'max(1rem, env(safe-area-inset-right))',
    bottom: 'max(1rem, env(safe-area-inset-bottom))',
    zIndex: 42,
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    transitionProperty: 'opacity',
    transitionDuration: '320ms',
    transitionTimingFunction: EASE_OUT,
  },
  btn: {
    paddingBlock: '0.5rem',
    paddingInline: '0.95rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'rgba(255, 255, 255, 0.28)',
      ':hover': 'rgba(255, 255, 255, 0.55)',
    },
    borderRadius: '999px',
    backgroundColor: 'rgba(8, 12, 20, 0.4)',
    backdropFilter: 'blur(6px)',
    color: {
      default: 'rgba(255, 255, 255, 0.8)',
      ':hover': '#fff',
    },
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transitionProperty: 'opacity, border-color, color',
    transitionDuration: '320ms, 320ms, 320ms',
    transitionTimingFunction: `${EASE_OUT}, ${EASE_OUT}, ${EASE_OUT}`,
  },
  btnIcon: {
    paddingBlock: '0.5rem',
    paddingInline: '0.7rem',
    fontSize: '0.9rem',
    lineHeight: 1,
  },
  gone: {
    opacity: 0,
    pointerEvents: 'none',
    animationName: 'none',
  },
  visuallyHidden: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: 0,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
})

export function Intro({ onDone }: { onDone: () => void }) {
  const { videoRef, soundRef, skipRef, frame, exitFilter, videoGone, controlsGone, promptGone, titlePhase, muted } =
    useIntro(onDone)

  return (
    <>
      <video
        ref={videoRef}
        {...stylex.props(s.video, exitFilter !== null && s.videoFilter(exitFilter), videoGone && s.videoGone)}
        playsInline
        muted
        preload="auto"
        poster="/intro/poster.jpg"
      />
      <div
        {...stylex.props(
          s.title,
          frame !== null && s.titleTop(`${frame.centre}px`),
          titlePhase === 'in' && s.titleIn,
          titlePhase === 'through' && s.titleThrough,
        )}
      >
        <div {...stylex.props(s.mark)}>
          <img
            {...stylex.props(
              s.markImg,
              frame !== null && s.markWidth(`${frame.mark}px`),
              titlePhase === 'in' && s.markForm,
            )}
            src="/intro/wordmark.webp"
            alt="Unstoppable Math"
          />
        </div>
        <p {...stylex.props(s.tag)} aria-hidden="true">
          Mastering math is a solved problem.
        </p>
      </div>
      <button {...stylex.props(s.prompt, promptGone && s.gone)} type="button" data-cuelume-press="tick">
        <span aria-hidden="true">{'\u{1F50A}'}</span> Tap for sound
      </button>
      <div {...stylex.props(s.controls, controlsGone && s.gone)}>
        <button
          ref={soundRef}
          {...stylex.props(s.btn, s.btnIcon)}
          type="button"
          aria-pressed={!muted}
          title="Sound"
          data-cuelume-press="tick"
        >
          <span aria-hidden="true">{muted ? '\u{1F507}' : '\u{1F50A}'}</span>
          <span {...stylex.props(s.visuallyHidden)}>{muted ? 'Turn sound on' : 'Turn sound off'}</span>
        </button>
        <button ref={skipRef} {...stylex.props(s.btn)} type="button" data-cuelume-press="tick">
          Skip
        </button>
      </div>
    </>
  )
}
