import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setupEnv.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Тесты работают с одной SQLite-базой, поэтому только один поток.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
