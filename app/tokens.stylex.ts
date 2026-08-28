import * as stylex from '@stylexjs/stylex'

export const t = stylex.defineVars({
  void: '#181818',
  ink: '#ffffff',
  mut: '#b3b3b3',
  accent: '#ec9228',
  rail: '16px',
  sans: 'var(--font-geist), system-ui, sans-serif',
  mono: 'var(--font-geist-mono), ui-monospace, monospace',
  serif: 'var(--font-stix), "Times New Roman", serif',
})

export const d = stylex.defineVars({
  line: `color-mix(in srgb, ${t.ink} 8%, transparent)`,
  gc: `color-mix(in srgb, ${t.accent} 85%, ${t.void})`,
})

const OKLCH = '@supports (color: oklch(from red l c h))'

export const g = stylex.defineVars({
  grim: {
    default: `color-mix(in srgb, ${d.gc} 50%, ${t.ink})`,
    [OKLCH]: `oklch(from ${d.gc} calc(l - 0.15) c h)`,
  },
  gline: {
    default: `color-mix(in srgb, ${t.ink} 70%, transparent)`,
    [OKLCH]: `oklch(from ${d.gc} 0.26 calc(c * 0.55) h)`,
  },
  gon: {
    default: `${t.void}`,
    [OKLCH]: `oklch(from ${d.gc} 0.97 calc(c * 0.12) h)`,
  },
})
