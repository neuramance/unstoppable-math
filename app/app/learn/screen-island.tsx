'use client'

import dynamic from 'next/dynamic'

const Screen = dynamic(() => import('./screen'), { ssr: false })

export default function ScreenIsland() {
  return <Screen />
}
