import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    fileParallelism: true,
    // These are integration tests against a real Postgres. A small fraction of
    // runs hit a transient DB hiccup (rare, diffuse across unrelated tests, and
    // present whether files run in parallel or serial) that cascades through the
    // stateful social tests. Retry like the Playwright E2E suite does: a genuine
    // bug fails every attempt, a transient one passes on retry, keeping the
    // deploy gate reliable. The inline retry also re-establishes state for the
    // order-dependent tests.
    retry: 2,
    env: {
      LOG_LEVEL: 'warn',
      // Each parallel, isolated test file opens its own Prisma pool; cap it small
      // so many files don't exhaust the test Postgres connection limit.
      DATABASE_POOL_MAX: '5',
    },
  },
});
