import { defineConfig } from '@playwright/test'

const port = Number(process.env.PORT || 3000)

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  workers: 3,
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: `PORT=${port} bun run start`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
