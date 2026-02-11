import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
