import type { EncodedSourceMap } from '@jridgewell/trace-mapping';
import { lowerPipeline } from './features/pipeline-operator/lower.js';

export interface LoweredFutureTypeScript {
  code: string;
  map: EncodedSourceMap;
}

export function lowerFutureTypeScript(
  source: string,
  fileName: string,
): LoweredFutureTypeScript {
  return lowerPipeline(source, fileName);
}
