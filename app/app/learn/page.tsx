import * as stylex from '@stylexjs/stylex'
import type { Metadata } from 'next'
import { t } from '@/app/tokens.stylex'

export const metadata: Metadata = { title: 'Learn · Unstoppable Math' }

const s = stylex.create({
  probe: {
    color: t.accent,
    fontFamily: t.mono,
    padding: 24,
  },
})

export default function LearnPage() {
  return <main {...stylex.props(s.probe)}>learn</main>
}
