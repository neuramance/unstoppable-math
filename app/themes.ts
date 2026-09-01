import * as stylex from '@stylexjs/stylex'
import { d, t } from './tokens.stylex'

const lightBase = stylex.createTheme(t, {
  void: '#ffffff',
  ink: '#16181c',
  mut: '#6b6f76',
})

const paperInk = '#3b2f21'

const paperBase = stylex.createTheme(t, {
  void: '#f8f7f3',
  ink: paperInk,
  mut: paperInk,
})

const paperLine = stylex.createTheme(d, {
  line: 'color-mix(in srgb, #ec9228 34%, transparent)',
})

const darkBase = stylex.createTheme(t, {
  void: '#0e0f11',
  ink: '#fafafa',
  mut: '#a6abb3',
})

const pureBase = stylex.createTheme(t, {
  void: '#000000',
  ink: '#e7e9ea',
  mut: '#d5d8da',
})

const pureLine = stylex.createTheme(d, {
  line: '#2f3336',
})

export const light = [lightBase]
export const paper = [paperBase, paperLine]
export const dark = [darkBase]
export const pure = [pureBase, pureLine]
