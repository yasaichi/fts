import fts from '@ftslang/build/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [fts()],
});
