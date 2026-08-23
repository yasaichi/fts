import { futureTypeScriptLanguageId as coreLanguageId } from '@ftslang/core';
import { describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };
import { futureTypeScriptLanguageId as clientLanguageId } from '../src/language-id.js';

describe('VS Code language contribution', () => {
  describe('language identifier', () => {
    it('uses the canonical ID in the language core', () => {
      expect(coreLanguageId).toBe('future-typescript');
    });

    it('matches the language core and VS Code client', () => {
      expect(clientLanguageId).toBe(coreLanguageId);
    });

    it('registers the canonical ID as a language', () => {
      const languageIds = manifest.contributes.languages.map(({ id }) => id);
      expect(languageIds).toEqual(['future-typescript']);
    });

    it('registers the canonical ID for its grammar', () => {
      const grammarLanguageIds = manifest.contributes.grammars.map(
        ({ language }) => language,
      );

      expect(grammarLanguageIds).toEqual(['future-typescript']);
    });
  });
});
