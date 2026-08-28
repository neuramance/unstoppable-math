import type { Metadata } from 'next'
import ScreenIsland from './screen-island'

export const metadata: Metadata = { title: 'Learn · Unstoppable Math' }

export default function LearnPage() {
  return <ScreenIsland />
}
