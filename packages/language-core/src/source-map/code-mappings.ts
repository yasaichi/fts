import {
  decodedMappings,
  TraceMap,
  type EncodedSourceMap,
} from '@jridgewell/trace-mapping';
import type { CodeMapping } from '@volar/language-core';
import { createScanner, LanguageVariant, ScriptTarget } from 'typescript';
import { codeInformation } from '../lowering.js';

const noCodeInformation = {} as const;

const syntheticVerificationInformation = {
  verification: true,
} as const;

export interface CodeMappingsInput {
  generated: string;
  source: string;
  sourceMap: EncodedSourceMap;
}

export interface SourceRange {
  end: number;
  start: number;
}

export function createCodeMappings(
  input: CodeMappingsInput,
  unmappedSourceRanges: readonly SourceRange[],
): CodeMapping[] {
  const generatedTokenLengthAt = createTokenLengthAt(input.generated);
  const points = createMappingPoints(input);
  const sourceTokenLengthAt = createTokenLengthAt(input.source);

  return [
    ...createSourceMappings(
      points,
      generatedTokenLengthAt,
      sourceTokenLengthAt,
      unmappedSourceRanges,
    ),
    ...createSyntheticVerificationMappings(
      points,
      generatedTokenLengthAt,
      unmappedSourceRanges,
    ),
  ];
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
): CodeMapping[] {
  return points.map((point) => {
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

    return {
      data: touchesSourceRange(
        point.sourceOffset,
        sourceLength,
        unmappedSourceRanges,
      )
        ? noCodeInformation
        : codeInformation,
      generatedLengths: [generatedLength],
      generatedOffsets: [point.generatedOffset],
      lengths: [sourceLength],
      sourceOffsets: [point.sourceOffset],
    };
  });
}

function createSyntheticVerificationMappings(
  points: readonly MappingPoint[],
  generatedTokenLengthAt: TokenLengthAt,
  sourceRanges: readonly SourceRange[],
): CodeMapping[] {
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
      {
        data: syntheticVerificationInformation,
        generatedLengths: [rangeLength(generatedRange)],
        generatedOffsets: [generatedRange.start],
        lengths: [rangeLength(sourceRange)],
        sourceOffsets: [sourceRange.start],
      },
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
  const scanner = createScanner(
    ScriptTarget.Latest,
    false,
    LanguageVariant.Standard,
    text,
  );

  return (offset: number): number => {
    scanner.setTextPos(offset);
    scanner.scan();
    return scanner.getTextPos() - offset;
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
  // Volar treats both mapping endpoints as valid locations.
  return ranges.some(
    (range) =>
      sourceOffset <= range.end && sourceOffset + sourceLength >= range.start,
  );
}
