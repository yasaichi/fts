import {
  parseSync,
  transformFromAstSync,
  types,
  type PluginItem,
} from '@babel/core';
import pipelineOperatorPlugin from '@babel/plugin-proposal-pipeline-operator';
import type { EncodedSourceMap } from '@jridgewell/trace-mapping';
import type { LoweredTypeScript } from '../../lowering.js';
import { pipelineOperatorConfig } from './config.js';
import { createPipelineMappings, type SourceRange } from './mappings.js';

interface TransformedPipeline {
  code: string;
  sourceMap: EncodedSourceMap;
}

export function lowerPipeline(
  source: string,
  fileName = 'source.fts',
): LoweredTypeScript {
  const ast = parsePipeline(source, fileName);
  const topicReferenceRanges = collectTopicReferenceRanges(ast);
  const transformed = transformPipeline(ast, source, fileName);

  return {
    code: transformed.code,
    mappings: createPipelineMappings({
      generated: transformed.code,
      source,
      sourceMap: transformed.sourceMap,
      topicReferenceRanges,
    }),
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

function parsePipeline(source: string, fileName: string): types.File {
  const ast = parseSync(source, {
    babelrc: false,
    configFile: false,
    filename: fileName,
    parserOpts: {
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

function transformPipeline(
  ast: types.File,
  source: string,
  fileName: string,
): TransformedPipeline {
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
          proposal: pipelineOperatorConfig.proposal,
          topicToken: pipelineOperatorConfig.topicToken,
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
    sourceMap: result.map as unknown as EncodedSourceMap,
  };
}
