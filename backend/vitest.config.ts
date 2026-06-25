import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    fileParallelism: true,
    env: {
      LOG_LEVEL: 'warn',
      // Each parallel, isolated test file opens its own Prisma pool; cap it small
      // so many files don't exhaust the test Postgres connection limit.
      DATABASE_POOL_MAX: '5',
    },
  },
});
