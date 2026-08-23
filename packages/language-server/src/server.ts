import { createFutureTypeScriptLanguagePlugin } from '@ftslang/core';
import {
  createConnection,
  createServer,
  createTypeScriptProject,
} from '@volar/language-server/node.js';
import * as typescript from 'typescript';
import { create as createTypeScriptServices } from 'volar-service-typescript';

const connection = createConnection();
const server = createServer(connection);

connection.onInitialize((params) => {
  return server.initialize(
    params,
    // Unlike the starter, this extension directly uses its pinned TypeScript.
    createTypeScriptProject(typescript, undefined, () => ({
      languagePlugins: [createFutureTypeScriptLanguagePlugin(typescript)],
    })),
    createTypeScriptServices(typescript),
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);

connection.listen();
