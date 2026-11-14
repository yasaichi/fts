import { createExportStub } from './export-stub.js';
import { createPipelineVirtualTypeScript } from './features/pipeline-operator/editor-lowering.js';
import { syntaxDiagnostic } from './features/pipeline-operator/lower.js';
import type { MapperDiagnostic, SpanMapping } from './lowering.js';

export interface TransformResult {
  diagnostics: MapperDiagnostic[];
  extension: '.ts';
  mappings: SpanMapping[];
  text: string;
}

export function transformFutureTypeScript(
  source: string,
  fileName: string,
): TransformResult {
  try {
    const { code, diagnostics, mappings } = createPipelineVirtualTypeScript(
      source,
      fileName,
    );
    return { diagnostics, extension: '.ts', mappings, text: code };
  } catch (error) {
    // Invalid proposal syntax must not escape into TypeScript's parser or erase
    // the module's exports and cause unrelated import errors in its consumers.
    return {
      diagnostics: [syntaxDiagnostic(error, source)],
      extension: '.ts',
      mappings: [],
      text: createExportStub(source),
    };
  }
}
