import { parseSync, transformFromAstSync, types } from '@babel/core';
import pipelineOperatorPlugin from '@babel/plugin-proposal-pipeline-operator';
import {
  type EncodedSourceMap,
  encodedMap,
  TraceMap,
} from '@jridgewell/trace-mapping';
import { pipelineOperatorConfig } from './config.js';
import type { SourceRange } from './mappings.js';

interface PipelineLowering {
  code: string;
  map: EncodedSourceMap;
  topicReferenceRanges: readonly SourceRange[];
}

interface PipelineParserOptions {
  errorRecovery: boolean;
}

export function lowerPipeline(
  source: string,
  fileName: string,
): Pick<PipelineLowering, 'code' | 'map'> {
  const { code, map } = createPipelineLowering(source, fileName, {
    errorRecovery: false,
  });

  return { code, map };
}

export function lowerPipelineForVirtualCode(
  source: string,
  fileName: string,
): PipelineLowering {
  return createPipelineLowering(source, fileName, { errorRecovery: true });
}

function createPipelineLowering(
  source: string,
  fileName: string,
  parserOptions: PipelineParserOptions,
): PipelineLowering {
  const ast = parsePipeline(source, fileName, parserOptions);
  const topicReferenceRanges = collectTopicReferenceRanges(ast);
  const transformed = transformPipeline(ast, source, fileName);
  const map = encodedMap(new TraceMap(transformed.sourceMap));

  return {
    code: transformed.code,
    map,
    topicReferenceRanges,
  };
}

function collectTopicReferenceRanges(ast: types.Node): SourceRange[] {
  const ranges: SourceRange[] = [];

  types.traverseFast(ast, (node) => {
    const range = topicReferenceRange(node);
    if (range) {
      ranges.push(range);
    }
  });

  return ranges;
}

function parsePipeline(
  source: string,
  fileName: string,
  parserOptions: PipelineParserOptions,
): types.File {
  const ast = parseSync(source, {
    babelrc: false,
    configFile: false,
    filename: fileName,
    parserOpts: {
      errorRecovery: parserOptions.errorRecovery,
      plugins: [
        [
          'pipelineOperator',
          {
            proposal: pipelineOperatorConfig.proposal,
            topicToken: pipelineOperatorConfig.topicToken,
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

  return ast;
}

function topicReferenceRange(node: types.Node): SourceRange | undefined {
  if (
    node.type !== 'TopicReference' ||
    typeof node.start !== 'number' ||
    typeof node.end !== 'number'
  ) {
    return undefined;
  }

  return { end: node.end, start: node.start };
}

function transformPipeline(ast: types.File, source: string, fileName: string) {
  const result = transformFromAstSync(ast, source, {
    ast: false,
    babelrc: false,
    cloneInputAst: false,
    comments: true,
    configFile: false,
    filename: fileName,
    plugins: [
      // @ts-expect-error Babel types require plugins to accept arbitrary options.
      [
        pipelineOperatorPlugin,
        {
          proposal: pipelineOperatorConfig.proposal,
          topicToken: pipelineOperatorConfig.topicToken,
        },
      ],
    ],
    sourceFileName: fileName,
    sourceMaps: true,
  });

  if (!result?.code || !result.map) {
    throw new Error(`Babel did not produce virtual TypeScript for ${fileName}`);
  }

  return {
    code: result.code,
    sourceMap: result.map,
  };
}
