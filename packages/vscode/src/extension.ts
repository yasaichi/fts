import { join } from 'node:path';
import type { ExtensionAPI, TypeScriptSDK } from 'typescript/vscode';
import {
  commands,
  type Disposable,
  type ExtensionContext,
  extensions,
  Uri,
  window,
} from 'vscode';
import mapperPackage from '../../content-mapper/package.json' with {
  type: 'json',
};

export async function activate(context: ExtensionContext): Promise<void> {
  let availabilityVersion = 0;
  let connected: ExtensionAPI | undefined;
  let disposed = false;
  let lastWarning: string | undefined;
  let registration: Disposable | undefined;
  let sdkListener: Disposable | undefined;

  const warn = (message: string): void => {
    if (lastWarning === message) return;
    lastWarning = message;
    void window
      .showWarningMessage(message, 'Select TypeScript Version')
      .then((action) => {
        if (action && !disposed)
          void commands.executeCommand(
            'typescript.native-preview.selectVersion',
          );
      });
  };
  const useSDK = (sdk: TypeScriptSDK): void => {
    if (sdk && !sdk.isCurrent()) return;
    registration?.dispose();
    registration = undefined;
    const required = mapperPackage.dependencies.typescript;
    if (sdk?.version !== required || !sdk.packageJsonPath) {
      warn(
        `FTS requires TypeScript ${required} with its JavaScript API package. Install it in your project and select it with TypeScript: Select TypeScript Version. Selected: ${sdk?.version ?? 'unknown'}.`,
      );
      return;
    }
    lastWarning = undefined;
    registration = connected?.registerContentMappers(context.extension.id, [
      {
        extensions: ['.fts'],
        inferredProjectContribution: {
          manifest: {
            name: mapperPackage.name,
            version: mapperPackage.version,
            ...mapperPackage.typescript.contentMapper,
            cwd: Uri.file(context.extensionUri.fsPath),
            exec: [
              process.execPath,
              join(context.extensionUri.fsPath, 'dist/mapper.mjs'),
              sdk.packageJsonPath,
            ],
          },
        },
      },
    ]);
  };
  const disconnect = (): void => {
    availabilityVersion++;
    connected = undefined;
    registration?.dispose();
    registration = undefined;
    sdkListener?.dispose();
    sdkListener = undefined;
  };
  const register = async (): Promise<void> => {
    const extension = extensions.getExtension<ExtensionAPI>(
      'TypeScriptTeam.native-preview',
    );
    if (!extension) {
      disconnect();
      return;
    }
    if (connected || disposed) return;
    const version = availabilityVersion;
    const api = await extension.activate();
    if (connected || disposed || version !== availabilityVersion) return;
    if (!api?.registerContentMappers || !api.onLanguageServerInitialized) {
      warn(
        'FTS requires the Microsoft TypeScript 7 extension with content mapper and SDK selection APIs. Update the TypeScript 7 extension.',
      );
      return;
    }
    connected = api;
    // Each initialization replaces the mapper, including same-path SDK upgrades.
    // SDK modules are cached inside the mapper process, so it must start afresh.
    sdkListener = api.onLanguageServerInitialized(useSDK);
  };
  context.subscriptions.push({
    dispose: () => {
      disposed = true;
      disconnect();
    },
  });
  context.subscriptions.push(extensions.onDidChange(register));
  await register();
}
