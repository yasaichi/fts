import { SpanMapFeature, SpanMapKind } from 'typescript/ast';
import { describe as context, describe, expect, it } from 'vitest';
import { createPipelineVirtualTypeScript } from '../../../src/features/pipeline-operator/editor-lowering.js';

describe('createPipelineVirtualTypeScript(source, fileName)', () => {
  context('when source contains a Hack-style pipeline', () => {
    const source = 'const result = input |> parse(%) |> format(%);';
    const lowered = createPipelineVirtualTypeScript(source, 'basic.fts');

    describe('code', () => {
      it('does not contain pipeline syntax', () => {
        expect(lowered.code).not.toContain('|>');
      });
    });

    describe('mappings', () => {
      const topicOffsets = Array.from(
        source.matchAll(/%/g),
        (match) => match.index,
      );

      it.each(['result', 'parse'])(
        'keeps the %s identifier available to semantic features',
        (identifier) => {
          expect(lowered.mappings).toContainEqual([
            lowered.code.indexOf(identifier),
            identifier.length,
            source.indexOf(identifier),
            identifier.length,
            SpanMapKind.Verbatim,
            SpanMapFeature.All,
          ]);
        },
      );

      it.each(topicOffsets)(
        'excludes the topic and both boundaries at source offset %i from semantic spans',
        (offset) => {
          const visible = lowered.mappings.filter(
            ([, , start, length, , features]) =>
              start <= offset + 1 &&
              start + length >= offset &&
              ((features ?? SpanMapFeature.All) &
                (SpanMapFeature.Hover | SpanMapFeature.Completion)) !==
                0,
          );
          expect(visible).toEqual([]);
        },
      );

      it.each(['parse', 'format'])(
        'maps the generated %s argument to its non-empty topic range',
        (callee) => {
          const start =
            lowered.code.lastIndexOf(`${callee}(`) + callee.length + 1;
          const end = lowered.code.indexOf(')', start);
          const offset = source.indexOf(`${callee}(%)`) + callee.length + 1;

          expect(lowered.mappings).toContainEqual([
            start,
            end - start,
            offset,
            1,
            SpanMapKind.Atom,
            0,
          ]);
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

  context.each([
    {
      condition: 'a same-line surrogate pair precedes the identifier',
      source: 'const label = "🌱"; const 日本語: number = 42',
    },
    {
      condition: 'a surrogate pair is on the preceding line',
      source: 'const label = "🌱";\nconst 日本語: number = 42',
    },
  ])('when $condition', ({ source }) => {
    const identifier = '日本語';
    const lowered = createPipelineVirtualTypeScript(source, 'unicode.fts');

    describe('mappings', () => {
      it('retains the identifier range in UTF-16 code units', () => {
        expect(lowered.mappings).toContainEqual([
          lowered.code.indexOf(identifier),
          identifier.length,
          source.indexOf(identifier),
          identifier.length,
          SpanMapKind.Verbatim,
          SpanMapFeature.All,
        ]);
      });
    });
  });
});
