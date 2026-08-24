import { readFileSync } from 'node:fs';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { ScriptTarget, transpileModule } from 'typescript';
import { assert, describe as context, describe, expect, it } from 'vitest';
import { lowerFutureTypeScript } from '../src/index.js';

describe('lowerFutureTypeScript(source, fileName)', () => {
  context('when source contains a Hack-style pipeline', () => {
    const source = readFileSync(
      new URL('./fixtures/pipeline-operator/basic.fts', import.meta.url),
      'utf8',
    );
    const lowered = lowerFutureTypeScript(source, 'basic.fts');

    describe('code', () => {
      it('does not contain pipeline syntax', () => {
        expect(lowered.code).not.toContain('|>');
      });

      it('has no TypeScript syntax errors', () => {
        expect(
          transpileModule(lowered.code, {
            compilerOptions: { target: ScriptTarget.ESNext },
            reportDiagnostics: true,
          }).diagnostics,
        ).toEqual([]);
      });
    });

    describe('map', () => {
      it('traces the generated symbol to the original source symbol', () => {
        const resultOffset = lowered.code.indexOf('result');
        assert.isAtLeast(resultOffset, 0);

        const generatedPrefix = lowered.code.slice(0, resultOffset);
        const original = originalPositionFor(new TraceMap(lowered.map), {
          column: resultOffset - (generatedPrefix.lastIndexOf('\n') + 1),
          line: (generatedPrefix.match(/\n/g)?.length ?? 0) + 1,
        });
        assert.isNotNull(original.column);
        assert.isNotNull(original.line);
        assert.isNotNull(original.source);

        const originalLine = source.split('\n')[original.line - 1];
        assert.isDefined(originalLine);
        expect(original.source).toBe('basic.fts');
        expect(originalLine.slice(original.column)).toMatch(/^result\b/);
      });
    });

    describe('mappings', () => {
      it('does not expose editor mappings', () => {
        expect(lowered).not.toHaveProperty('mappings');
      });
    });
  });

  context('when source is invalid', () => {
    it('throws an error containing the filename', () => {
      expect(() =>
        lowerFutureTypeScript('const answer: = 42', 'invalid.fts'),
      ).toThrow(/invalid\.fts/);
    });
  });
});
