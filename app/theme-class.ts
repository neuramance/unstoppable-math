import * as stylex from '@stylexjs/stylex'
import { dark, light, paper, pure } from './themes'

export const THEMES = ['light', 'paper', 'dark', 'pure', 'classic'] as const

export type ThemeName = (typeof THEMES)[number]

export const THEME_CLASS: Record<ThemeName, string> = {
  classic: '',
  light: stylex.props(...light).className ?? '',
  paper: stylex.props(...paper).className ?? '',
  dark: stylex.props(...dark).className ?? '',
  pure: stylex.props(...pure).className ?? '',
}
