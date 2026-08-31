import stylex from '@stylexjs/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { '@stylexjs': stylex },
    rules: {
      '@stylexjs/valid-styles': 'error',
      '@stylexjs/valid-shorthands': 'error',
      '@stylexjs/enforce-extension': 'error',
      '@stylexjs/no-unused': 'error',
      '@stylexjs/no-legacy-contextual-styles': 'error',
      '@stylexjs/no-nonstandard-styles': 'error',
      '@stylexjs/no-conflicting-props': 'error',
    },
  },
  {
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-lines': ['error', 500],
      'max-lines-per-function': ['error', { max: 150 }],
    },
  },
  {
    files: ['app/app/learn/session.tsx'],
    rules: { complexity: ['error', 30] },
  },
  {
    files: ['app/app/learn/teach.tsx'],
    rules: {
      complexity: ['error', 32],
      'max-lines-per-function': ['error', { max: 244 }],
    },
  },
  {
    files: ['app/app/learn/figures-view.tsx'],
    rules: { 'max-lines': ['error', 671] },
  },
  {
    files: ['app/app/learn/intro.tsx'],
    rules: {
      'max-lines': ['error', 532],
      'max-lines-per-function': ['error', { max: 237 }],
    },
  },
  {
    files: ['app/app/learn/user-pill.tsx'],
    rules: {
      'max-lines': ['error', 582],
      'max-lines-per-function': ['error', { max: 175 }],
    },
  },
  {
    files: ['babel.config.js', 'postcss.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'test-results/**', 'playwright-report/**']),
])
