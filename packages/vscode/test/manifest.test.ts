import { describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };

describe('VS Code language contribution', () => {
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
