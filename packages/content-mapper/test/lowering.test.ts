import { parseSync } from '@babel/core';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { describe as context, describe, expect, it } from 'vitest';
import { lowerFutureTypeScript } from '../src/index.js';

describe('lowerFutureTypeScript(source, fileName)', () => {
  context('when source contains a Hack-style pipeline', () => {
    const source = 'const result: string = input |> parse(%) |> format(%);';
    const lowered = lowerFutureTypeScript(source, 'basic.fts');

    describe('code', () => {
      it('does not contain pipeline syntax', () => {
        expect(lowered.code).not.toContain('|>');
      });

      it('has no TypeScript syntax errors', () => {
        expect(() =>
          parseSync(lowered.code, { parserOpts: { plugins: ['typescript'] } }),
        ).not.toThrow();
      });
    });

    describe('map', () => {
      it('traces the generated symbol to the original source symbol', () => {
        const offset = lowered.code.indexOf('result');
        expect(offset).toBeGreaterThanOrEqual(0);
        const prefix = lowered.code.slice(0, offset);
        const original = originalPositionFor(new TraceMap(lowered.map), {
          column: offset - prefix.lastIndexOf('\n') - 1,
          line: prefix.split('\n').length,
        });

        expect(original).toMatchObject({
          column: 6,
          line: 1,
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
