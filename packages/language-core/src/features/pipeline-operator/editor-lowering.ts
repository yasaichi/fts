import type { LoweredTypeScript } from '../../lowering.js';
import { lowerPipelineForEditing } from './lower.js';
import { createPipelineMappings } from './mappings.js';

export function createPipelineVirtualTypeScript(
  source: string,
  fileName: string,
): LoweredTypeScript {
  const { code, map, topicReferenceRanges } = lowerPipelineForEditing(
    source,
    fileName,
  );

  return {
    code,
    mappings: createPipelineMappings({
      generated: code,
      source,
      sourceMap: map,
      topicReferenceRanges,
    }),
  };
}
