import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { futureTypeScriptLanguageId as coreLanguageId } from 'fts-language-core';
import { describe, expect, it } from 'vitest';

import { futureTypeScriptLanguageId as clientLanguageId } from '../src/language-id.js';

interface ExtensionManifest {
  contributes: {
    grammars: Array<{ language: string }>;
    languages: Array<{ id: string }>;
  };
}

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

describe('VS Code language contribution', () => {
  describe('language identifier', () => {
    it('matches the language core and extension manifest', async () => {
      const manifest = JSON.parse(
        await readFile(path.join(packageRoot, 'package.json'), 'utf8'),
      ) as ExtensionManifest;

      expect(clientLanguageId).toBe(coreLanguageId);
      expect(manifest.contributes.languages.map(({ id }) => id)).toContain(
        clientLanguageId,
      );
      expect(
        manifest.contributes.grammars.map(({ language }) => language),
      ).toContain(clientLanguageId);
    });
  });
});
