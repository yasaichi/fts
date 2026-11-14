import { decodedMappings, TraceMap } from '@jridgewell/trace-mapping';
import { SpanMapFeature } from 'typescript/ast';
import { createScanner } from 'typescript/ast/scanner';
import type { SpanMapping } from '../lowering.js';

export interface CodeMappingsInput {
  generated: string;
  source: string;
  sourceMap: ConstructorParameters<typeof TraceMap>[0];
}

export interface SourceRange {
  end: number;
  start: number;
}

export function createCodeMappings(
  input: CodeMappingsInput,
  unmappedSourceRanges: readonly SourceRange[],
): SpanMapping[] {
  const generatedTokenLengthAt = createTokenLengthAt(input.generated);
  const points = createMappingPoints(input);
  const sourceTokenLengthAt = createTokenLengthAt(input.source);

  const sourceMappings = createSourceMappings(
    points,
    generatedTokenLengthAt,
    sourceTokenLengthAt,
    unmappedSourceRanges,
    input,
  );
  const topicMappings = createSyntheticVerificationMappings(
    points,
    generatedTokenLengthAt,
    unmappedSourceRanges,
  );

  // Native span maps cannot overlap. Topic projections own their generated
  // ranges so synthesized temporaries never become editable source symbols.
  const mappings = [
    ...sourceMappings.filter(
      ([start, length]) =>
        !topicMappings.some(
          ([topicStart, topicLength]) =>
            start < topicStart + topicLength && start + length > topicStart,
        ),
    ),
    ...topicMappings,
  ].toSorted((left, right) => left[0] - right[0]);
  const nonOverlapping: SpanMapping[] = [];
  for (const mapping of mappings) {
    const previous = nonOverlapping.at(-1);
    if (!previous || mapping[0] >= previous[0] + previous[1])
      nonOverlapping.push(mapping);
  }
  return nonOverlapping;
}

function createLineOffsets(text: string): number[] {
  return [0, ...Array.from(text.matchAll(/\n/g), (match) => match.index + 1)];
}

function createMappingPoints({
  generated,
  source,
  sourceMap,
}: CodeMappingsInput) {
  const generatedLineOffsets = createLineOffsets(generated);
  const sourceLineOffsets = createLineOffsets(source);

  return decodedMappings(new TraceMap(sourceMap)).flatMap(
    (segments, generatedLine) => {
      const generatedLineOffset = generatedLineOffsets[generatedLine];
      if (generatedLineOffset === undefined) {
        return [];
      }

      return segments.flatMap((segment, segmentIndex) => {
        if (segment.length < 4) {
          return [];
        }

        const [generatedColumn, , sourceLine, sourceColumn] = segment;
        if (sourceLine === undefined || sourceColumn === undefined) {
          return [];
        }

        const sourceLineOffset = sourceLineOffsets[sourceLine];
        if (sourceLineOffset === undefined) {
          return [];
        }

        const generatedOffset = generatedLineOffset + generatedColumn;
        const sourceOffset = sourceLineOffset + sourceColumn;
        const [nextGeneratedColumn, , nextSourceLine, nextSourceColumn] =
          segments[segmentIndex + 1] ?? [];

        return [
          {
            generatedLimit:
              nextGeneratedColumn === undefined
                ? lineEndOffset(generated, generatedOffset)
                : generatedLineOffset + nextGeneratedColumn,
            generatedOffset,
            sourceLimit:
              nextSourceLine === sourceLine &&
              nextSourceColumn !== undefined &&
              nextSourceColumn > sourceColumn
                ? sourceLineOffset + nextSourceColumn
                : lineEndOffset(source, sourceOffset),
            sourceOffset,
          },
        ];
      });
    },
  );
}

type MappingPoint = ReturnType<typeof createMappingPoints>[number];

function createSourceMappings(
  points: readonly MappingPoint[],
  generatedTokenLengthAt: TokenLengthAt,
  sourceTokenLengthAt: TokenLengthAt,
  unmappedSourceRanges: readonly SourceRange[],
  input: CodeMappingsInput,
): SpanMapping[] {
  // EOF points anchor topic projections but have no token for a native span.
  const tokenPoints = points.filter(
    ({ generatedOffset, sourceOffset }) =>
      generatedOffset < input.generated.length &&
      sourceOffset < input.source.length,
  );
  return tokenPoints.map((point): SpanMapping => {
    const generatedLength = tokenLengthWithin(
      generatedTokenLengthAt,
      point.generatedOffset,
      point.generatedLimit,
    );
    const sourceLength = tokenLengthWithin(
      sourceTokenLengthAt,
      point.sourceOffset,
      point.sourceLimit,
    );

    const verbatim =
      generatedLength === sourceLength &&
      input.generated.slice(
        point.generatedOffset,
        point.generatedOffset + generatedLength,
      ) ===
        input.source.slice(
          point.sourceOffset,
          point.sourceOffset + sourceLength,
        );
    return [
      point.generatedOffset,
      generatedLength,
      point.sourceOffset,
      sourceLength,
      verbatim ? 0 : 1,
      touchesSourceRange(point.sourceOffset, sourceLength, unmappedSourceRanges)
        ? 0
        : SpanMapFeature.All,
    ];
  });
}

function createSyntheticVerificationMappings(
  points: readonly MappingPoint[],
  generatedTokenLengthAt: TokenLengthAt,
  sourceRanges: readonly SourceRange[],
): SpanMapping[] {
  return sourceRanges.flatMap((sourceRange) => {
    const generatedRange = findGeneratedRange(
      points,
      generatedTokenLengthAt,
      sourceRange,
    );
    if (!generatedRange) {
      return [];
    }

    return [
      [
        generatedRange.start,
        rangeLength(generatedRange),
        sourceRange.start,
        rangeLength(sourceRange),
        1,
        0,
      ] satisfies SpanMapping,
    ];
  });
}

function findGeneratedRange(
  points: readonly MappingPoint[],
  generatedTokenLengthAt: TokenLengthAt,
  sourceRange: SourceRange,
) {
  const sourceOffsets = points.map((point) => point.sourceOffset);
  const previousSourceOffset = sourceOffsets
    .filter((offset) => offset < sourceRange.start)
    .toSorted((left, right) => left - right)
    .at(-1);
  const nextSourceOffset = sourceOffsets
    .filter((offset) => offset >= sourceRange.end)
    .toSorted((left, right) => left - right)[0];

  if (previousSourceOffset === undefined || nextSourceOffset === undefined) {
    return undefined;
  }

  const previousPoints = points.filter(
    (point) => point.sourceOffset === previousSourceOffset,
  );
  const nextPoints = points.filter(
    (point) => point.sourceOffset === nextSourceOffset,
  );

  return previousPoints
    .flatMap((previous) =>
      nextPoints.map((next) => ({
        end: next.generatedOffset,
        start:
          previous.generatedOffset +
          generatedTokenLengthAt(previous.generatedOffset),
      })),
    )
    .filter((range) => range.end > range.start)
    .toSorted((left, right) => rangeLength(left) - rangeLength(right))[0];
}

function lineEndOffset(text: string, offset: number): number {
  const newline = text.indexOf('\n', offset);
  return newline === -1 ? text.length : newline;
}

function rangeLength(range: SourceRange): number {
  return range.end - range.start;
}

function createTokenLengthAt(text: string) {
  const scanner = createScanner(false, undefined, text);

  return (offset: number): number => {
    scanner.resetTokenState(offset);
    scanner.scan();
    return scanner.getTokenEnd() - offset;
  };
}

type TokenLengthAt = ReturnType<typeof createTokenLengthAt>;

function tokenLengthWithin(
  tokenLengthAt: TokenLengthAt,
  offset: number,
  limit: number,
): number {
  return Math.max(1, Math.min(tokenLengthAt(offset), limit - offset));
}

function touchesSourceRange(
  sourceOffset: number,
  sourceLength: number,
  ranges: readonly SourceRange[],
): boolean {
  // Point-based semantic requests include both endpoints of a span.
  return ranges.some(
    (range) =>
      sourceOffset <= range.end && sourceOffset + sourceLength >= range.start,
  );
}
