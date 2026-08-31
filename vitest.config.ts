import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@stylexjs/stylex': path.resolve(import.meta.dirname, 'vitest.stylex-stub.ts'),
      '@': path.resolve(import.meta.dirname),
    },
  },
  test: {
    testTimeout: process.env.CI ? 30_000 : 5_000,
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.test.{ts,tsx}', 'lib/**/*.test.ts', 'content/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
