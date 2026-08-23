import { SourceMap } from '@volar/language-core';
import { readFileSync } from 'node:fs';
import * as typescript from 'typescript';
import { URI } from 'vscode-uri';
import { describe, expect, it } from 'vitest';
import { FutureTypeScriptVirtualCode } from '../src/index.js';

describe('FutureTypeScriptVirtualCode', () => {
  const source = readFileSync(
    new URL('./fixtures/pipeline-operator/incomplete.fts', import.meta.url),
    'utf8',
  );
  const virtualCode = new FutureTypeScriptVirtualCode(
    typescript,
    URI.file('/workspace/incomplete.fts'),
    typescript.ScriptSnapshot.fromString(source),
  );
  describe('snapshot', () => {
    it('preserves an incomplete document', () => {
      expect(
        virtualCode.snapshot.getText(0, virtualCode.snapshot.getLength()),
      ).toBe(source);
    });
  });

  describe('mappings', () => {
    it('keeps incomplete document symbols available to semantic features', () => {
      const generatedOffsets = Array.from(
        new SourceMap(virtualCode.mappings).toGeneratedLocation(
          source.indexOf('result'),
          (information) => Boolean(information.semantic),
        ),
        ([generatedOffset]) => generatedOffset,
      );

      expect(generatedOffsets).toContain(source.indexOf('result'));
    });
  });
});
