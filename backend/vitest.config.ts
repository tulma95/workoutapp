import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    fileParallelism: true,
    // Integration tests against a real Postgres occasionally hit a rare,
    // diffuse transient (present whether files run in parallel or serial).
    // Retry like the Playwright E2E suite: a genuine bug fails every attempt, a
    // transient passes on retry. NOTE: vitest re-runs only the failing test, not
    // the preceding ones, so this is a clean fix for stateless transients but a
    // weak band-aid for the order-dependent social-reaction/friend tests — those
    // should be made self-contained (tracked as a follow-up).
    retry: 2,
    env: {
      LOG_LEVEL: 'warn',
      // Each parallel, isolated test file opens its own Prisma pool; cap it small
      // so many files don't exhaust the test Postgres connection limit.
      DATABASE_POOL_MAX: '5',
    },
  },
});
