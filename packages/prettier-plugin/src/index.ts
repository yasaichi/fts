import type { Plugin } from 'prettier';
import { parsers } from 'prettier/plugins/babel';

const plugin = {
  languages: [
    {
      extensions: ['.fts'],
      name: 'Future TypeScript',
      parsers: ['fts'],
    },
  ],
  parsers: {
    fts: parsers['babel-ts'],
  },
} satisfies Plugin;

export default plugin;
