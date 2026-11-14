import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { ExtensionAPI } from 'typescript/vscode';
import {
  type Disposable,
  type ExtensionContext,
  extensions,
  Uri,
} from 'vscode';

export async function activate(context: ExtensionContext): Promise<void> {
  let availabilityVersion = 0;
  let registration: Disposable | undefined;
  let disposed = false;
  const register = async (): Promise<void> => {
    const extension = extensions.getExtension<ExtensionAPI>(
      'TypeScriptTeam.native-preview',
    );
    if (!extension) {
      availabilityVersion++;
      registration?.dispose();
      registration = undefined;
      return;
    }
    if (registration) return;
    const version = availabilityVersion;
    const api = await extension.activate();
    if (
      !api?.registerContentMappers ||
      registration ||
      disposed ||
      version !== availabilityVersion
    )
      return;
    const require = createRequire(
      context.extensionUri.fsPath + '/package.json',
    );
    const manifestPath = require.resolve(
      '@ftslang/content-mapper/package.json',
    );
    const manifest = require(manifestPath) as {
      name: string;
      version: string;
      typescript: {
        contentMapper: {
          compilerOptions: string[];
          dynamicConfig: boolean;
          exec: string[];
        };
      };
    };
    const mapper = manifest.typescript.contentMapper;
    registration = api.registerContentMappers(context.extension.id, [
      {
        extensions: ['.fts'],
        inferredProjectContribution: {
          manifest: {
            name: manifest.name,
            version: manifest.version,
            compilerOptions: mapper.compilerOptions,
            dynamicConfig: mapper.dynamicConfig,
            cwd: Uri.file(dirname(manifestPath)),
            exec: [
              process.execPath,
              resolve(dirname(manifestPath), mapper.exec[1]),
            ],
          },
        },
      },
    ]);
  };
  context.subscriptions.push({
    dispose: () => {
      disposed = true;
      registration?.dispose();
    },
  });
  context.subscriptions.push(extensions.onDidChange(register));
  await register();
}
