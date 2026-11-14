import { describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };

describe('VS Code language contribution', () => {
  describe('languages', () => {
    it('registers the FTS extension under its canonical language ID', () => {
      expect(manifest.contributes.languages).toContainEqual(
        expect.objectContaining({
          id: 'future-typescript',
          extensions: ['.fts'],
        }),
      );
    });
  });

  describe('grammars', () => {
    it('uses the registered language ID for the FTS grammar', () => {
      expect(manifest.contributes.grammars).toContainEqual(
        expect.objectContaining({
          language: manifest.contributes.languages[0].id,
          scopeName: 'source.fts',
        }),
      );
    });
  });
});
