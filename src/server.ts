import {
  createConnection,
  createServer,
  createTypeScriptProject,
} from '@volar/language-server/node.js';
import * as typescript from 'typescript';
import { create as createTypeScriptServicePlugins } from 'volar-service-typescript';

import { createFutureTypeScriptLanguagePlugin } from './language/plugin.js';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) =>
  server.initialize(
    params,
    createTypeScriptProject(typescript, undefined, () => ({
      languagePlugins: [createFutureTypeScriptLanguagePlugin(typescript)],
    })),
    createTypeScriptServicePlugins(typescript),
  ),
);

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
