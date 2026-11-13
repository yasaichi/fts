import { readFileSync } from 'node:fs';
import { SpanMap, SpanMapFeature } from 'typescript/ast';
import { describe as context, describe, expect, it } from 'vitest';
import { createPipelineVirtualTypeScript } from '../../../src/features/pipeline-operator/editor-lowering.js';

function spanMap(
  mappings: ReturnType<typeof createPipelineVirtualTypeScript>['mappings'],
) {
  return new SpanMap(
    mappings.map(
      ([
        virtualStart,
        virtualLength,
        originalStart,
        originalLength,
        kind,
        features,
      ]) => ({
        virtualStart,
        virtualEnd: virtualStart + virtualLength,
        originalStart,
        originalEnd: originalStart + originalLength,
        kind,
        features,
      }),
    ),
  );
}

describe('createPipelineVirtualTypeScript(source, fileName)', () => {
  context('when source contains a Hack-style pipeline', () => {
    const source = readFileSync(
      new URL('../../fixtures/pipeline-operator/basic.fts', import.meta.url),
      'utf8',
    );
    const lowered = createPipelineVirtualTypeScript(source, 'basic.fts');

    describe('code', () => {
      it('does not contain pipeline syntax', () => {
        expect(lowered.code).not.toContain('|>');
      });
    });

    describe('mappings', () => {
      const map = spanMap(lowered.mappings);
      const topicOffsets = Array.from(
        source.matchAll(/%/g),
        (match) => match.index,
      );

      it('keeps ordinary source symbols available to semantic features', () => {
        expect(
          map.originalToVirtualPositions(
            source.indexOf('result'),
            SpanMapFeature.Hover,
          ),
        ).toContainEqual(
          expect.objectContaining({ position: lowered.code.indexOf('result') }),
        );
      });

      it.each(topicOffsets)(
        'excludes topic at source offset %i from hover',
        (offset) => {
          expect(
            map.originalToVirtualPositions(offset, SpanMapFeature.Hover),
          ).toEqual([]);
        },
      );

      it.each(topicOffsets)(
        'excludes topic end at source offset %i from completion',
        (offset) => {
          expect(
            map.originalToVirtualPositions(
              offset + 1,
              SpanMapFeature.Completion,
            ),
          ).toEqual([]);
        },
      );

      it.each(['parse', 'format'])(
        'projects the generated %s argument to its non-empty topic range',
        (callee) => {
          const start =
            lowered.code.lastIndexOf(`${callee}(`) + callee.length + 1;
          const end = lowered.code.indexOf(')', start);
          const offset = source.indexOf(`${callee}(%)`) + callee.length + 1;

          expect(map.virtualToOriginalSpan({ pos: start, end }).range).toEqual({
            pos: offset,
            end: offset + 1,
          });
        },
      );

      it('does not overlap generated spans', () => {
        for (let index = 1; index < lowered.mappings.length; index++) {
          const previous = lowered.mappings[index - 1];
          expect(lowered.mappings[index][0]).toBeGreaterThanOrEqual(
            previous[0] + previous[1],
          );
        }
      });
    });
  });

  context(
    'when a same-line surrogate pair precedes a Unicode identifier',
    () => {
      const identifier = '日本語';
      const source = `const label = "🌱"; const ${identifier}: number = 42`;
      const lowered = createPipelineVirtualTypeScript(source, 'unicode.fts');

      describe('mappings', () => {
        const map = spanMap(lowered.mappings);

        it.each(Array.from({ length: identifier.length }, (_, index) => index))(
          'keeps identifier offset %i available to semantic features',
          (offset) => {
            expect(
              map.originalToVirtualPositions(
                source.indexOf(identifier) + offset,
                SpanMapFeature.Hover,
              ),
            ).toContainEqual(
              expect.objectContaining({
                position: lowered.code.indexOf(identifier) + offset,
              }),
            );
          },
        );
      });
    },
  );
});
