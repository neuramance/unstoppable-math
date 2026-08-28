import * as stylex from '@stylexjs/stylex'
import { ThinkingOrb } from 'thinking-orbs'
import type { ThinkingOrbProps } from 'thinking-orbs'
import { chrome } from './chrome'

export function Orb(props: ThinkingOrbProps) {
  return <ThinkingOrb state="solving" theme="dark" aria-hidden {...props} />
}

export function shellInert(): boolean {
  return document.querySelector('[data-appshell][inert]') !== null
}

export function EnterKey() {
  return (
    <kbd {...stylex.props(chrome.kbdhint, chrome.kbdOnGame)} aria-hidden="true">
      ↵
    </kbd>
  )
}
