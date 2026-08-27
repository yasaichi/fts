import fts from '@ftslang/build/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [fts()],
  test: {
    exclude: ['test/fixtures/**'],
    include: ['test/**/*.test.{fts,ts}'],
  },
});
