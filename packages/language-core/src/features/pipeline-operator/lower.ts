import {
  parseSync,
  transformFromAstSync,
  types,
  type PluginItem,
} from '@babel/core';
import pipelineOperatorPlugin from '@babel/plugin-proposal-pipeline-operator';
import {
  decodedMappings,
  TraceMap,
  type EncodedSourceMap,
} from '@jridgewell/trace-mapping';
import type { CodeMapping } from '@volar/language-core';

import { codeInformation, type LoweredTypeScript } from '../../lowering.js';
import { pipelineFeature } from './config.js';

const syntheticVerificationInformation = {
  verification: true,
} as const;

const noCodeInformation = {} as const;

interface SourceRange {
  end: number;
  start: number;
}

export function lowerPipeline(
  source: string,
  fileName = 'source.fts',
): LoweredTypeScript {
  const ast = parseSync(source, {
    babelrc: false,
    configFile: false,
    filename: fileName,
    parserOpts: {
      plugins: [
        [
          'pipelineOperator',
          {
            proposal: pipelineFeature.proposal,
            topicToken: pipelineFeature.topicToken,
          },
        ],
        'typescript',
      ],
      sourceType: 'unambiguous',
    },
  });

  if (!ast) {
    throw new Error(`Babel did not produce an AST for ${fileName}`);
  }

  const topicReferenceRanges = collectTopicReferenceRanges(ast);
  const result = transformFromAstSync(ast, source, {
    ast: false,
    babelrc: false,
    cloneInputAst: false,
    comments: true,
    configFile: false,
    filename: fileName,
    plugins: [
      [
        pipelineOperatorPlugin,
        {
          proposal: pipelineFeature.proposal,
          topicToken: pipelineFeature.topicToken,
        },
      ] as unknown as PluginItem,
    ],
    sourceFileName: fileName,
    sourceMaps: true,
  });

  if (!result?.code || !result.map) {
    throw new Error(`Babel did not produce virtual TypeScript for ${fileName}`);
  }

  return {
    code: result.code,
    mappings: createCodeMappings(
      source,
      result.code,
      result.map as unknown as EncodedSourceMap,
      topicReferenceRanges,
    ),
  };
}

function addTopicReferenceMappings(
  source: string,
  generated: string,
  mappings: CodeMapping[],
  decoded: ReturnType<typeof decodedMappings>,
  topicReferenceRanges: SourceRange[],
): void {
  const sourceLineOffsets = createLineOffsets(source);
  const generatedLineOffsets = createLineOffsets(generated);
  const points: Array<{ generatedOffset: number; sourceOffset: number }> = [];

  decoded.forEach((segments, generatedLine) => {
    segments.forEach((segment) => {
      if (segment.length < 4) {
        return;
      }
      const sourceLine = segment[2];
      const sourceColumn = segment[3];
      if (sourceLine === undefined || sourceColumn === undefined) {
        return;
      }

      points.push({
        generatedOffset: generatedLineOffsets[generatedLine]! + segment[0],
        sourceOffset: sourceLineOffsets[sourceLine]! + sourceColumn,
      });
    });
  });

  topicReferenceRanges.forEach((topicRange) => {
    const previousSourceOffset = Math.max(
      ...points
        .filter((point) => point.sourceOffset < topicRange.start)
        .map((point) => point.sourceOffset),
    );
    const nextSourceOffset = Math.min(
      ...points
        .filter((point) => point.sourceOffset >= topicRange.end)
        .map((point) => point.sourceOffset),
    );
    const previousPoints = points.filter(
      (point) => point.sourceOffset === previousSourceOffset,
    );
    const nextPoints = points.filter(
      (point) => point.sourceOffset === nextSourceOffset,
    );
    const generatedRange = previousPoints
      .flatMap((previous) =>
        nextPoints.map((next) => ({
          end: next.generatedOffset,
          start:
            previous.generatedOffset +
            tokenLengthAt(generated, previous.generatedOffset),
        })),
      )
      .filter((range) => range.end > range.start)
      .toSorted(
        (left, right) => left.end - left.start - (right.end - right.start),
      )[0];

    if (!generatedRange) {
      return;
    }

    mappings.push({
      data: syntheticVerificationInformation,
      generatedLengths: [generatedRange.end - generatedRange.start],
      generatedOffsets: [generatedRange.start],
      lengths: [topicRange.end - topicRange.start],
      sourceOffsets: [topicRange.start],
    });
  });
}

function createCodeMappings(
  source: string,
  generated: string,
  sourceMap: EncodedSourceMap,
  topicReferenceRanges: SourceRange[],
): CodeMapping[] {
  const traceMap = new TraceMap(sourceMap);
  const decoded = decodedMappings(traceMap);
  const sourceLineOffsets = createLineOffsets(source);
  const generatedLineOffsets = createLineOffsets(generated);
  const mappings: CodeMapping[] = [];

  decoded.forEach((segments, generatedLine) => {
    segments.forEach((segment, segmentIndex) => {
      if (segment.length < 4) {
        return;
      }
      const sourceLine = segment[2];
      const sourceColumn = segment[3];
      if (sourceLine === undefined || sourceColumn === undefined) {
        return;
      }

      const generatedOffset = generatedLineOffsets[generatedLine]! + segment[0];
      const sourceOffset = sourceLineOffsets[sourceLine]! + sourceColumn;
      const nextSegment = segments[segmentIndex + 1];
      const generatedLimit = nextSegment
        ? generatedLineOffsets[generatedLine]! + nextSegment[0]
        : lineEndOffset(generated, generatedOffset);
      const nextSourceLine = nextSegment?.[2];
      const nextSourceColumn = nextSegment?.[3];
      const sourceLimit =
        nextSourceLine !== undefined &&
        nextSourceColumn !== undefined &&
        nextSourceLine === sourceLine &&
        nextSourceColumn > sourceColumn
          ? sourceLineOffsets[nextSourceLine]! + nextSourceColumn
          : lineEndOffset(source, sourceOffset);
      const generatedLength = Math.max(
        1,
        Math.min(
          tokenLengthAt(generated, generatedOffset),
          generatedLimit - generatedOffset,
        ),
      );
      const sourceLength = Math.max(
        1,
        Math.min(
          tokenLengthAt(source, sourceOffset),
          sourceLimit - sourceOffset,
        ),
      );
      const touchesTopicReference = topicReferenceRanges.some(
        (topicRange) =>
          sourceOffset <= topicRange.end &&
          sourceOffset + sourceLength >= topicRange.start,
      );

      mappings.push({
        data: touchesTopicReference ? noCodeInformation : codeInformation,
        generatedLengths: [generatedLength],
        generatedOffsets: [generatedOffset],
        lengths: [sourceLength],
        sourceOffsets: [sourceOffset],
      });
    });
  });

  addTopicReferenceMappings(
    source,
    generated,
    mappings,
    decoded,
    topicReferenceRanges,
  );
  return mappings;
}

function collectTopicReferenceRanges(ast: types.Node): SourceRange[] {
  const ranges: SourceRange[] = [];

  types.traverseFast(ast, (node) => {
    if (
      node.type === 'TopicReference' &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      ranges.push({ end: node.end, start: node.start });
    }
  });

  return ranges;
}

function createLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function lineEndOffset(text: string, offset: number): number {
  const newline = text.indexOf('\n', offset);
  return newline === -1 ? text.length : newline;
}

function tokenLengthAt(text: string, offset: number): number {
  const rest = text.slice(offset);
  const identifier = /^[$A-Z_a-z][$\w]*/.exec(rest);
  if (identifier) {
    return identifier[0].length;
  }

  const whitespace = /^\s+/.exec(rest);
  if (whitespace) {
    return whitespace[0].replace(/\n[\s\S]*$/, '').length || 1;
  }

  return rest.length > 0 ? 1 : 0;
}
