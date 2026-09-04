import { defineConfig } from '@playwright/test'

const port = Number(process.env.PORT || 3099)

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  workers: '100%',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `PORT=${port} bun run start`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
