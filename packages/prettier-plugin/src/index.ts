import type { Plugin } from 'prettier';
import { parsers } from 'prettier/plugins/babel';

const plugin = {
  languages: [
    {
      extensions: ['.fts'],
      name: 'Future TypeScript',
      parsers: ['fts'],
      vscodeLanguageIds: ['future-typescript'],
    },
  ],
  parsers: {
    fts: parsers['babel-ts'],
  },
} satisfies Plugin;

export default plugin;
