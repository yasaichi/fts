import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 180000,
    include: ['e2e/npm.test.ts'],
    testTimeout: 180000,
  },
});
