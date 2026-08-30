import {
  createConnection,
  createServer,
  createTypeScriptProject,
} from '@volar/language-server/node.js';
import * as typescript from 'typescript';
import { createFutureTypeScriptLanguageTools } from './language-tools.js';

const connection = createConnection();
const server = createServer(connection);

connection.onInitialize((params) => {
  const languageTools = createFutureTypeScriptLanguageTools(typescript);

  return server.initialize(
    params,
    // Unlike the starter, this extension directly uses its pinned TypeScript.
    createTypeScriptProject(typescript, undefined, () => ({
      languagePlugins: languageTools.languagePlugins,
    })),
    languageTools.services,
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);

connection.listen();
