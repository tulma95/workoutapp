import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }]],
  timeout: 10000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-first-failure',
    screenshot: 'on-first-failure',
    navigationTimeout: 10000,
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'webkit',
      use: { ...devices['iPhone 15 Pro'] },
    },
  ],
})
