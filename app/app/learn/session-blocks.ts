import * as stylex from '@stylexjs/stylex'
import { t } from '@/app/tokens.stylex'
import type { BlockKind } from '@/lib/session'

export const OKLCH = '@supports (color: oklch(from red l c h))'

export const BLOCK_LABEL: Record<BlockKind, string> = {
  narrative: 'Narrative',
  atom: 'Learn',
  review: 'Review',
}

export const BLOCK_GLYPH: Record<BlockKind, string> = {
  narrative: '▶',
  atom: '★',
  review: '↻',
}

export const tints = stylex.create({
  narrative: { '--sessc': `color-mix(in srgb, rgba(255,150,50,1) 85%, ${t.void})` },
  instruction: { '--sessc': `color-mix(in srgb, rgba(53,143,243,1) 85%, ${t.void})` },
  testing: { '--sessc': `color-mix(in srgb, rgba(40,210,110,1) 85%, ${t.void})` },
})

export const KIND_TINT: Record<BlockKind, (typeof tints)[keyof typeof tints]> = {
  narrative: tints.narrative,
  atom: tints.instruction,
  review: tints.testing,
}

export const tintVars = stylex.create({
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
})
