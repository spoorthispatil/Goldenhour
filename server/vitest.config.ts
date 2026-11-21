import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    // One shared test database; the API suite creates its own data.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000,
  },
});
