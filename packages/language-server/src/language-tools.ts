import { createFutureTypeScriptLanguagePlugin } from '@ftslang/core';
import type * as ts from 'typescript';
import { create as createTypeScriptServices } from 'volar-service-typescript';

export function createFutureTypeScriptLanguageTools(typescript: typeof ts) {
  return {
    languagePlugins: [createFutureTypeScriptLanguagePlugin(typescript)],
    services: createTypeScriptServices(typescript),
  };
}
