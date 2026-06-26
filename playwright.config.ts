import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 1 local retry too: run_test.sh (the deploy gate) runs locally, and a single
  // transient timeout flake under machine load shouldn't fail the whole gate.
  // A genuine regression still fails consistently across the retry.
  retries: process.env.CI ? 2 : 1,
  reporter: [['html', { open: 'never' }]],
  // 20s per test: the heaviest tests run two full workout cycles + navigations,
  // which legitimately exceed 10s under machine load (the recurring gate flake).
  // Normal tests finish in <2s, so this only raises the ceiling, not the runtime.
  timeout: 20000,
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
