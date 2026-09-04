import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@stylexjs/stylex': path.resolve(import.meta.dirname, 'vitest.stylex-stub.ts'),
      '@': path.resolve(import.meta.dirname),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['lib/**/*.test.ts', 'content/**/*.test.ts'],
          exclude: ['lib/store.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'http://localhost/' } },
          setupFiles: ['./vitest.setup.ts'],
          include: ['app/**/*.test.{ts,tsx}', 'lib/store.test.ts'],
        },
      },
    ],
  },
})
