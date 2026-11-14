import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContentMapperContribution } from 'typescript/vscode';
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
  getExtension: vi.fn<(id: string) => unknown>(),
  onDidChange: vi.fn<(listener: () => unknown) => { dispose: () => void }>(),
  registerContentMappers:
    vi.fn<
      (
        id: string,
        contributions: readonly ContentMapperContribution[],
      ) => { dispose: () => void }
    >(),
}));
vi.mock('vscode', () => ({
  extensions: {
    getExtension: mocks.getExtension,
    onDidChange: mocks.onDidChange,
  },
  Uri: { file: (fsPath: string) => ({ scheme: 'file', fsPath }) },
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

  beforeEach(() => {
    extensionContext = {
      extension: { id: 'test.ftslang-vscode' },
      extensionUri: { fsPath: fileURLToPath(new URL('../', import.meta.url)) },
      subscriptions: [],
    } as unknown as ExtensionContext;
    mocks.onDidChange.mockReturnValue({ dispose: vi.fn<() => void>() });
  });

  afterEach(() => vi.resetAllMocks());

  context('when the native TypeScript extension is available', () => {
    beforeEach(() => {
      mocks.getExtension.mockImplementation(findNativeExtension);
      mocks.activate.mockResolvedValue({
        registerContentMappers: mocks.registerContentMappers,
      });
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
                    fsPath: expect.stringContaining('/content-mapper'),
                  },
                  exec: [
                    process.execPath,
                    expect.stringContaining('/content-mapper/dist/mapper.cjs'),
                  ],
                },
              },
            },
          ],
        );
        const [, contributions] = mocks.registerContentMappers.mock.calls[0];
        expect(
          existsSync(
            contributions[0].inferredProjectContribution?.manifest.exec[1] ??
              '',
          ),
        ).toBe(true);
      });
    });

    context('when a mapper is already registered', () => {
      beforeEach(async () => {
        await activate(extensionContext);
      });

      describe('extension changes', () => {
        it('keeps the existing registration', async () => {
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
          await mocks.onDidChange.mock.calls[0][0]();
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
        });
      });

      context('when the native extension is removed and returns', () => {
        it('replaces the released registration', async () => {
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
          expect(mocks.dispose).not.toHaveBeenCalled();

          mocks.getExtension.mockReturnValue(undefined);
          await mocks.onDidChange.mock.calls[0][0]();
          expect(mocks.dispose).toHaveBeenCalledOnce();
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();

          mocks.getExtension.mockImplementation(findNativeExtension);
          await mocks.onDidChange.mock.calls[0][0]();
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

      context('when the FTS extension is disposed', () => {
        it('does not register after activation finishes', async () => {
          const activating = activate(extensionContext);
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();

          extensionContext.subscriptions.forEach((subscription) =>
            subscription.dispose(),
          );
          pending.resolve({
            registerContentMappers: mocks.registerContentMappers,
          });
          await activating;
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        });
      });

      context('when an extension change overlaps activation', () => {
        it('registers once after both activations finish', async () => {
          const activating = activate(extensionContext);
          expect(mocks.registerContentMappers).not.toHaveBeenCalled();

          const changing = mocks.onDidChange.mock.calls[0][0]();
          pending.resolve({
            registerContentMappers: mocks.registerContentMappers,
          });
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
        mocks.activate.mockResolvedValue({
          registerContentMappers: mocks.registerContentMappers,
        });
        mocks.registerContentMappers.mockReturnValue({
          dispose: mocks.dispose,
        });
      });

      it('registers when the extension is discovered', async () => {
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
        mocks.getExtension.mockImplementation(findNativeExtension);
        await mocks.onDidChange.mock.calls[0][0]();
        expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
      });
    });
  });
});
