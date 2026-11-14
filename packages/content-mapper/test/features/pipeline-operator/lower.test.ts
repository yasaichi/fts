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
      condition: 'a complete pipeline ends without a newline',
      identifier: 'parse',
      source: 'const result = input |> parse(%)',
    },
    {
      condition: 'an unfinished pipeline ends without a newline',
      identifier: 'Ma',
      source: 'const result = input |> Ma',
    },
    {
      condition: 'an unfinished pipeline ends with a newline',
      identifier: 'Ma',
      source: 'const result = input |> Ma\n',
    },
  ])('when $condition', ({ identifier, source }) => {
    const lowered = createPipelineVirtualTypeScript(source, 'editing.fts');

    describe('mappings', () => {
      it('keeps every span inside its source and generated text', () => {
        for (const [
          start,
          length,
          sourceStart,
          sourceLength,
        ] of lowered.mappings) {
          expect(start + length).toBeLessThanOrEqual(lowered.code.length);
          expect(sourceStart + sourceLength).toBeLessThanOrEqual(source.length);
        }
      });

      it('retains semantic access to the identifier', () => {
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

  context('when the final pipeline topic is at the end of the file', () => {
    const source = 'const result = "x" |> % - %';
    const lowered = createPipelineVirtualTypeScript(source, 'topic-eof.fts');

    describe('mappings', () => {
      it('projects the final generated operand to a source topic', () => {
        const operand = lowered.code.lastIndexOf(' - ') + ' - '.length;
        const projection = lowered.mappings.find(
          ([start, length, sourceStart, sourceLength, kind, features]) =>
            start <= operand &&
            operand < start + length &&
            source.slice(sourceStart, sourceStart + sourceLength) === '%' &&
            kind === SpanMapKind.Atom &&
            features === 0,
        );
        expect(projection).toBeDefined();
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
