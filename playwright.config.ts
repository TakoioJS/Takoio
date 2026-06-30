import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
  },
  // 两个 webServer: Nitro API (8080) + Vite client dev (9820)
  // reuseExistingServer 让用户已启动的 dev server 直接复用,不重复启动
  webServer: [
    {
      command: 'pnpm dev:server',
      url: 'http://127.0.0.1:8080/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:9820',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'api', testMatch: /api\.spec\.ts/ },
    { name: 'ui', testMatch: /ui\.spec\.ts/ },
  ],
})
