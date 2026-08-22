import { SourceMap } from '@volar/language-core';
import { describe, expect, it } from 'vitest';

import { lowerPipeline } from '../../../src/index.js';

describe('lowerPipeline', () => {
  describe('when source contains a Hack-style pipeline', () => {
    const source = [
      'declare const input: string',
      'declare function parse(value: string): { id: number }',
      'declare function format(value: { id: number }): string',
      '',
      'const result = input',
      '  |> parse(%)',
      '  |> format(%)',
    ].join('\n');
    const subject = () => lowerPipeline(source);

    it('lowers each stage to an ordinary function call', () => {
      const lowered = subject();

      expect(lowered.code).not.toContain('|>');
      expect(lowered.code).toMatch(/parse\(input\)/);
      expect(lowered.code).toMatch(/format\(_ref\)/);
    });

    describe('source mappings', () => {
      it('maps ordinary source symbols for semantic features', () => {
        const lowered = subject();
        const sourceMap = new SourceMap(lowered.mappings);
        const sourceResult = source.indexOf('result');
        const generatedResults = [
          ...sourceMap.toGeneratedLocation(sourceResult, (information) =>
            Boolean(information.semantic),
          ),
        ];

        expect(
          generatedResults.some(([offset]) =>
            lowered.code.startsWith('result', offset),
          ),
        ).toBe(true);
      });

      it('excludes the topic token from semantic features', () => {
        const lowered = subject();
        const sourceMap = new SourceMap(lowered.mappings);
        const sourceTopic = source.lastIndexOf('%');

        expect([
          ...sourceMap.toGeneratedLocation(sourceTopic, (information) =>
            Boolean(information.semantic),
          ),
        ]).toEqual([]);
      });

      it('maps the generated temporary to the topic for verification', () => {
        const lowered = subject();
        const sourceMap = new SourceMap(lowered.mappings);
        const generatedTopic = lowered.code.lastIndexOf('_ref');
        const sourceRanges = [
          ...sourceMap.toSourceRange(
            generatedTopic,
            generatedTopic + '_ref'.length,
            true,
            (information) => Boolean(information.verification),
          ),
        ];

        expect(
          sourceRanges.map(([start, end]) => source.slice(start, end)),
        ).toEqual(['%']);
      });
    });
  });
});
