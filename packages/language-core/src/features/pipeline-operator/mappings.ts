import {
  createCodeMappings,
  type CodeMappingsInput,
  type SourceRange,
} from '../../source-map/code-mappings.js';

export type { SourceRange } from '../../source-map/code-mappings.js';

export function createPipelineMappings({
  generated,
  source,
  sourceMap,
  topicReferenceRanges,
}: CodeMappingsInput & {
  topicReferenceRanges: readonly SourceRange[];
}) {
  return createCodeMappings(
    { generated, source, sourceMap },
    topicReferenceRanges,
  );
}
