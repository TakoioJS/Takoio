import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev:server',
    url: 'http://127.0.0.1:8080/health',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'api', testMatch: /.*\.spec\.ts/ },
  ],
})
