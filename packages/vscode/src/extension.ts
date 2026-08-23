import * as vscode from 'vscode';
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from 'vscode-languageclient/node';

import { futureTypeScriptLanguageId } from './language-id.js';

let client: LanguageClient | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const serverModule = require.resolve('@ftslang/server');
  const serverOptions: ServerOptions = {
    debug: {
      module: serverModule,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
      transport: TransportKind.ipc,
    },
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: futureTypeScriptLanguageId,
        scheme: 'file',
      },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.fts'),
    },
  };

  client = new LanguageClient(
    'future-typescript-language-server',
    'Future TypeScript Language Server',
    serverOptions,
    clientOptions,
  );
  context.subscriptions.push(client);
  await client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
