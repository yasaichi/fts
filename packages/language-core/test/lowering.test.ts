import { readFileSync } from 'node:fs';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { ScriptTarget, transpileModule } from 'typescript';
import { describe as context, describe, expect, it } from 'vitest';
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
      // oxlint-disable-next-line unicorn/consistent-function-scoping -- Keep this helper within the map contract.
      const positionOfSymbol = (text: string, symbol: string) => {
        const offset = text.indexOf(symbol);

        if (offset < 0) {
          throw new Error(`Could not find "${symbol}" in source`);
        }

        const prefix = text.slice(0, offset);
        return {
          column: offset - (prefix.lastIndexOf('\n') + 1),
          line: prefix.split('\n').length,
        };
      };

      it('traces the generated symbol to the original source symbol', () => {
        const original = originalPositionFor(
          new TraceMap(lowered.map),
          positionOfSymbol(lowered.code, 'result'),
        );

        expect(original).toMatchObject({
          column: 6,
          line: 5,
          source: 'basic.fts',
        });
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
