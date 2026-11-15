import { fileURLToPath } from 'node:url';
import type {
  ContentMapperContribution,
  ExtensionAPI,
  TypeScriptSDK,
} from 'typescript/vscode';
import {
  afterEach,
  beforeEach,
  describe as context,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ExtensionContext } from 'vscode';

const mocks = vi.hoisted(() => ({
  activate: vi.fn<() => Promise<unknown>>(),
  dispose: vi.fn<() => void>(),
  disposeSDKListener: vi.fn<() => void>(),
  executeCommand: vi.fn<(command: string) => Promise<unknown>>(),
  getExtension: vi.fn<(id: string) => unknown>(),
  notifyExtensionsChanged: vi.fn<() => unknown>(),
  notifySDKInitialized: vi.fn<(sdk: TypeScriptSDK) => void>(),
  onLanguageServerInitialized:
    vi.fn<ExtensionAPI['onLanguageServerInitialized']>(),
  registerContentMappers:
    vi.fn<
      (
        id: string,
        contributions: readonly ContentMapperContribution[],
      ) => { dispose: () => void }
    >(),
  showWarningMessage:
    vi.fn<(...args: string[]) => Promise<string | undefined>>(),
}));
vi.mock('vscode', () => ({
  extensions: {
    getExtension: mocks.getExtension,
    onDidChange(listener: () => unknown) {
      mocks.notifyExtensionsChanged.mockImplementation(listener);
      return { dispose: () => mocks.notifyExtensionsChanged.mockReset() };
    },
  },
  Uri: { file: (fsPath: string) => ({ scheme: 'file', fsPath }) },
  commands: { executeCommand: mocks.executeCommand },
  window: { showWarningMessage: mocks.showWarningMessage },
}));

import { activate } from '../src/extension.js';

function findNativeExtension(id: string) {
  // VS Code returns a fresh wrapper for each lookup of the same extension.
  return id === 'TypeScriptTeam.native-preview'
    ? { activate: mocks.activate }
    : undefined;
}

describe('activate(context)', () => {
  let extensionContext: ExtensionContext;
  let sdk: TypeScriptSDK;
  const api = {
    onLanguageServerInitialized: mocks.onLanguageServerInitialized,
    registerContentMappers: mocks.registerContentMappers,
  };

  beforeEach(() => {
    sdk = {
      version: '7.1.0-beta',
      packageJsonPath: '/selected SDK/node_modules/typescript/package.json',
      isCurrent: () => true,
      importModule: vi.fn<TypeScriptSDK['importModule']>(),
      initializeAPIConnection:
        vi.fn<TypeScriptSDK['initializeAPIConnection']>(),
    };
    mocks.showWarningMessage.mockResolvedValue(undefined);
    mocks.onLanguageServerInitialized.mockImplementation(
      (listener: (sdk: TypeScriptSDK) => void) => {
        mocks.notifySDKInitialized.mockImplementation(listener);
        listener(sdk);
        return { dispose: mocks.disposeSDKListener };
      },
    );
    extensionContext = {
      extension: { id: 'test.ftslang-vscode' },
      extensionUri: { fsPath: fileURLToPath(new URL('../', import.meta.url)) },
      subscriptions: [],
    } as unknown as ExtensionContext;
  });

  afterEach(() => vi.resetAllMocks());

  context('when the native TypeScript extension is available', () => {
    beforeEach(() => {
      mocks.getExtension.mockImplementation(findNativeExtension);
      mocks.activate.mockResolvedValue(api);
      mocks.registerContentMappers.mockReturnValue({ dispose: mocks.dispose });
    });

    describe('mapper registration', () => {
      it('contributes the real executable only to inferred projects', async () => {
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        await activate(extensionContext);
        expect(mocks.registerContentMappers).toHaveBeenCalledExactlyOnceWith(
          extensionContext.extension.id,
          [
            {
              extensions: ['.fts'],
              inferredProjectContribution: {
                manifest: {
                  name: '@ftslang/content-mapper',
                  version: '0.0.1',
                  compilerOptions: [],
                  dynamicConfig: false,
                  cwd: {
                    scheme: 'file',
                    fsPath: extensionContext.extensionUri.fsPath,
                  },
                  exec: [
                    process.execPath,
                    fileURLToPath(
                      new URL('../dist/mapper.mjs', import.meta.url),
                    ),
                    sdk.packageJsonPath,
                  ],
                },
              },
            },
          ],
        );
      });
    });

    context('when the SDK is unsupported', () => {
      beforeEach(() => {
        sdk = { ...sdk, version: '7.0.2' };
      });

      it('explains the required SDK without registering a mapper or changing settings', async () => {
        await activate(extensionContext);
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        expect(mocks.showWarningMessage).toHaveBeenCalledExactlyOnceWith(
          expect.stringContaining('FTS requires TypeScript 7.1.0-beta'),
          'Select TypeScript Version',
        );
        expect(mocks.executeCommand).not.toHaveBeenCalled();
      });

      it('does not repeat the same warning on a server restart', async () => {
        await activate(extensionContext);
        mocks.notifySDKInitialized(sdk);
        expect(mocks.showWarningMessage).toHaveBeenCalledOnce();
      });

      context('when the user selects the setup action', () => {
        beforeEach(() => {
          mocks.showWarningMessage.mockResolvedValue(
            'Select TypeScript Version',
          );
        });

        it('opens the official version picker', async () => {
          await activate(extensionContext);
          expect(mocks.executeCommand).toHaveBeenCalledExactlyOnceWith(
            'typescript.native-preview.selectVersion',
          );
        });
      });

      context('when a supported SDK is selected later', () => {
        it('registers the mapper for that SDK', async () => {
          await activate(extensionContext);
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();
          mocks.notifySDKInitialized({ ...sdk, version: '7.1.0-beta' });
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
        });
      });
    });

    context('when the SDK has no matching API package', () => {
      beforeEach(() => {
        sdk = { ...sdk, packageJsonPath: undefined };
      });

      it('requests a full SDK instead of starting a broken mapper', async () => {
        await activate(extensionContext);
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        expect(mocks.showWarningMessage).toHaveBeenCalledWith(
          expect.stringContaining('JavaScript API package'),
          'Select TypeScript Version',
        );
      });
    });

    context('when the selected SDK is newer than the certified preview', () => {
      beforeEach(() => {
        sdk = { ...sdk, version: '7.1.0' };
      });

      it('requests the tested version instead of assuming API compatibility', async () => {
        await activate(extensionContext);
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        expect(mocks.showWarningMessage).toHaveBeenCalledWith(
          expect.stringContaining('Selected: 7.1.0.'),
          'Select TypeScript Version',
        );
      });
    });

    context('when the official extension does not expose the SDK API', () => {
      beforeEach(() => {
        mocks.activate.mockResolvedValue({
          registerContentMappers: mocks.registerContentMappers,
        });
      });

      it('explains that the TypeScript 7 extension needs updating', async () => {
        await activate(extensionContext);
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        expect(mocks.showWarningMessage).toHaveBeenCalledWith(
          expect.stringContaining('Update the TypeScript 7 extension'),
          'Select TypeScript Version',
        );
      });
    });

    context('when the initialization belongs to an obsolete SDK', () => {
      beforeEach(() => {
        sdk.isCurrent = () => false;
      });

      it('does not register a mapper for it', async () => {
        await activate(extensionContext);
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
      });
    });

    context('when the SDK changes after registration', () => {
      it('keeps the current mapper when an obsolete initialization arrives', async () => {
        await activate(extensionContext);
        mocks.notifySDKInitialized({ ...sdk, isCurrent: () => false });
        expect(mocks.dispose).not.toHaveBeenCalled();
        expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
      });
      it('replaces the registration with the newly selected SDK', async () => {
        await activate(extensionContext);
        expect(mocks.dispose).not.toHaveBeenCalled();
        mocks.notifySDKInitialized({
          ...sdk,
          packageJsonPath: '/another SDK/typescript/package.json',
        });
        expect(mocks.dispose).toHaveBeenCalledOnce();
        expect(
          mocks.registerContentMappers.mock.lastCall?.[1][0]?.inferredProjectContribution?.manifest.exec.at(
            -1,
          ),
        ).toBe('/another SDK/typescript/package.json');
      });

      it('stops contributing a mapper when the new SDK is unsupported', async () => {
        await activate(extensionContext);
        mocks.notifySDKInitialized({ ...sdk, version: '7.0.2' });
        expect(mocks.dispose).toHaveBeenCalledOnce();
        expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
        expect(mocks.showWarningMessage).toHaveBeenCalledOnce();
      });
    });

    context('when the same SDK is restarted', () => {
      it('replaces the mapper so SDK module caches cannot survive the restart', async () => {
        await activate(extensionContext);
        mocks.notifySDKInitialized(sdk);
        expect(mocks.dispose).toHaveBeenCalledOnce();
        expect(mocks.registerContentMappers).toHaveBeenCalledTimes(2);
      });
    });

    context('when a mapper is already registered', () => {
      beforeEach(async () => {
        await activate(extensionContext);
      });

      describe('extension changes', () => {
        it('keeps the existing registration', async () => {
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
          await mocks.notifyExtensionsChanged();
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
        });
      });

      describe('disposal', () => {
        it('releases the mapper registration', () => {
          expect(mocks.dispose).not.toHaveBeenCalled();
          extensionContext.subscriptions.forEach((subscription) =>
            subscription.dispose(),
          );
          expect(mocks.dispose).toHaveBeenCalledOnce();
          expect(mocks.disposeSDKListener).toHaveBeenCalledOnce();
        });
      });

      context('when the native extension is removed and returns', () => {
        it('replaces the released registration', async () => {
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
          expect(mocks.dispose).not.toHaveBeenCalled();

          mocks.getExtension.mockReturnValue(undefined);
          await mocks.notifyExtensionsChanged();
          expect(mocks.dispose).toHaveBeenCalledOnce();
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();

          mocks.getExtension.mockImplementation(findNativeExtension);
          await mocks.notifyExtensionsChanged();
          expect(mocks.registerContentMappers).toHaveBeenCalledTimes(2);
          expect(mocks.dispose).toHaveBeenCalledOnce();
        });
      });
    });

    context('when the native extension activation is pending', () => {
      let pending: ReturnType<typeof Promise.withResolvers<unknown>>;

      beforeEach(() => {
        pending = Promise.withResolvers<unknown>();
        mocks.activate.mockReturnValue(pending.promise);
      });

      context('when the native extension is removed', () => {
        it('does not register after the earlier activation finishes', async () => {
          const activating = activate(extensionContext);
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();

          mocks.getExtension.mockReturnValue(undefined);
          await mocks.notifyExtensionsChanged();
          pending.resolve(api);
          await activating;
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        });
      });

      context('when the FTS extension is disposed', () => {
        it('does not register after activation finishes', async () => {
          const activating = activate(extensionContext);
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();

          extensionContext.subscriptions.forEach((subscription) =>
            subscription.dispose(),
          );
          pending.resolve(api);
          await activating;
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        });
      });

      context('when an extension change overlaps activation', () => {
        it('registers once after both activations finish', async () => {
          const activating = activate(extensionContext);
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();

          const changing = mocks.notifyExtensionsChanged();
          pending.resolve(api);
          await Promise.all([activating, changing]);
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
        });
      });
    });
  });

  context('when the native TypeScript extension is absent', () => {
    beforeEach(() => {
      mocks.getExtension.mockReturnValue(undefined);
    });

    describe('mapper registration', () => {
      it('does not contribute a mapper', async () => {
        await activate(extensionContext);
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
      });
    });

    context('when the native extension becomes available later', () => {
      beforeEach(async () => {
        await activate(extensionContext);
        mocks.activate.mockResolvedValue(api);
        mocks.registerContentMappers.mockReturnValue({
          dispose: mocks.dispose,
        });
      });

      it('registers when the extension is discovered', async () => {
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        mocks.getExtension.mockImplementation(findNativeExtension);
        await mocks.notifyExtensionsChanged();
        expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
      });
    });
  });
});
