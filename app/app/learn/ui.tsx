import * as stylex from '@stylexjs/stylex'
import { chrome } from './chrome'

export function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function shellInert(): boolean {
  return document.querySelector('[data-appshell][inert]') !== null
}

export function enterHotkey(e: KeyboardEvent): boolean {
  if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || shellInert()) return false
  const focus = document.activeElement
  return focus === null || focus.closest('a, button, [role="menuitemradio"]') === null
}

export function EnterKey() {
  return (
    <kbd {...stylex.props(chrome.kbdhint, chrome.kbdOnGame)} aria-hidden="true">
      ↵
    </kbd>
  )
}
