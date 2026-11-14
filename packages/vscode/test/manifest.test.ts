import { assert, describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };

describe('VS Code language contribution', () => {
  describe('grammars', () => {
    it('uses the registered language ID for the FTS grammar', () => {
      const [language] = manifest.contributes.languages;
      assert.isDefined(language);
      expect(manifest.contributes.grammars).toContainEqual(
        expect.objectContaining({
          language: language.id,
          scopeName: 'source.fts',
        }),
      );
    });
  });
});
