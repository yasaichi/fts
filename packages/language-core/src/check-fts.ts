import { createRequire } from 'node:module';
import { runTsc } from '@volar/typescript/lib/quickstart/runTsc.js';
import * as typescript from 'typescript';
import { createFutureTypeScriptCompilerPlugin } from './language-plugin.js';

const require = createRequire(import.meta.url);

runTsc(require.resolve('typescript/lib/tsc'), ['.fts'], () => [
  createFutureTypeScriptCompilerPlugin(typescript),
]);
