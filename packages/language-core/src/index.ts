export {
  createFutureTypeScriptLanguagePlugin,
  FutureTypeScriptVirtualCode,
  futureTypeScriptLanguageId,
} from './language-plugin.js';
export { lowerPipeline } from './features/pipeline-operator/lower.js';
export {
  createIdentityLowering,
  type LoweredTypeScript,
} from './lowering.js';
