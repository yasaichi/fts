import { SourceMap } from '@volar/language-core';
import { readFileSync } from 'node:fs';
import { ScriptTarget, transpileModule } from 'typescript';
import { describe, describe as context, expect, it } from 'vitest';
import { lowerPipeline } from '../../../src/index.js';

describe('lowerPipeline(source, fileName)', () => {
  context('when source contains a Hack-style pipeline', () => {
    const pipelineSource = readFileSync(
      new URL('../../fixtures/pipeline-operator/basic.fts', import.meta.url),
      'utf8',
    );
    const lowered = lowerPipeline(pipelineSource);

    describe('code', () => {
      it('does not contain pipeline syntax', () => {
        expect(lowered.code).not.toContain('|>');
      });

      it('has no syntax errors', () => {
        const transpilation = transpileModule(lowered.code, {
          compilerOptions: { target: ScriptTarget.ESNext },
          reportDiagnostics: true,
        });

        expect(transpilation.diagnostics).toEqual([]);
      });
    });

    describe('mappings', () => {
      const sourceMap = new SourceMap(lowered.mappings);
      const topicOffsets = Array.from(
        pipelineSource.matchAll(/%/g),
        (match) => match.index,
      );

      it('keeps ordinary source symbols available to semantic features', () => {
        const generatedOffsets = Array.from(
          sourceMap.toGeneratedLocation(
            pipelineSource.indexOf('result'),
            (information) => Boolean(information.semantic),
          ),
          ([generatedOffset]) => generatedOffset,
        );

        expect(generatedOffsets).toContain(lowered.code.indexOf('result'));
      });

      it.each(topicOffsets)(
        'excludes topic at source offset %i from semantic features',
        (topicOffset) => {
          const semanticLocations = Array.from(
            sourceMap.toGeneratedLocation(topicOffset, (information) =>
              Boolean(information.semantic),
            ),
          );

          expect(semanticLocations).toEqual([]);
        },
      );

      it.each(topicOffsets)(
        'maps topic at source offset %i to a non-empty verification range',
        (topicOffset) => {
          const verificationRanges = Array.from(
            sourceMap.toGeneratedRange(
              topicOffset,
              topicOffset + 1,
              false,
              (information) => Boolean(information.verification),
            ),
          );
          const [verificationRange] = verificationRanges;

          expect(verificationRanges).toHaveLength(1);
          const [generatedStart, generatedEnd] = verificationRange!;
          expect(generatedEnd).toBeGreaterThan(generatedStart);
        },
      );
    });
  });

  context('when source contains only current TypeScript syntax', () => {
    const source = 'const answer: number = 42';
    const lowered = lowerPipeline(source);

    describe('code', () => {
      it('has no syntax errors', () => {
        const transpilation = transpileModule(lowered.code, {
          compilerOptions: { target: ScriptTarget.ESNext },
          reportDiagnostics: true,
        });

        expect(transpilation.diagnostics).toEqual([]);
      });
    });

    describe('mappings', () => {
      it('keeps ordinary source symbols available to semantic features', () => {
        const generatedOffsets = Array.from(
          new SourceMap(lowered.mappings).toGeneratedLocation(
            source.indexOf('answer'),
            (information) => Boolean(information.semantic),
          ),
          ([generatedOffset]) => generatedOffset,
        );

        expect(generatedOffsets).toContain(lowered.code.indexOf('answer'));
      });
    });
  });

  context('when source contains a Unicode identifier', () => {
    const identifier = '日本語';
    const source = `const ${identifier}: number = 42`;
    const lowered = lowerPipeline(source);

    describe('mappings', () => {
      it.each(Array.from({ length: identifier.length }, (_, index) => index))(
        'keeps identifier offset %i available to semantic features',
        (offset) => {
          const generatedOffsets = Array.from(
            new SourceMap(lowered.mappings).toGeneratedLocation(
              source.indexOf(identifier) + offset,
              (information) => Boolean(information.semantic),
            ),
            ([generatedOffset]) => generatedOffset,
          );

          expect(generatedOffsets).toContain(
            lowered.code.indexOf(identifier) + offset,
          );
        },
      );
    });
  });
});
