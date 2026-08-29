import type { Plugin } from 'prettier';

const plugin = {
  languages: [
    {
      extensions: ['.fts'],
      name: 'Future TypeScript',
      parsers: ['babel-ts'],
    },
  ],
} satisfies Plugin;

export default plugin;
