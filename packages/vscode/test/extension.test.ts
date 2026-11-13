import { existsSync } from 'node:fs';
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

function createExtensionContext() {
  return {
    extension: { id: 'test.ftslang-vscode' },
    extensionUri: { fsPath: new URL('../', import.meta.url).pathname },
    subscriptions: [],
  } as unknown as ExtensionContext;
}

describe('activate(context)', () => {
  beforeEach(() => {
    mocks.onDidChange.mockReturnValue({ dispose: vi.fn<() => void>() });
  });

  afterEach(() => vi.resetAllMocks());

  context('when the native TypeScript extension is available', () => {
    beforeEach(() => {
      // VS Code returns a fresh wrapper for each lookup, even for one extension.
      mocks.getExtension.mockImplementation((id) =>
        id === 'TypeScriptTeam.native-preview'
          ? { id, activate: mocks.activate }
          : undefined,
      );
      mocks.activate.mockResolvedValue({
        registerContentMappers: mocks.registerContentMappers,
      });
      mocks.registerContentMappers.mockReturnValue({ dispose: mocks.dispose });
    });

    context('when extensions change after activation', () => {
      let extensionContext: ExtensionContext;

      beforeEach(async () => {
        extensionContext = createExtensionContext();
        await activate(extensionContext);
        await mocks.onDidChange.mock.calls[0][0]();
      });

      describe('mapper registration', () => {
        it('contributes the real executable only to inferred projects', () => {
          const [contributor, contributions] =
            mocks.registerContentMappers.mock.calls[0];
          expect(contributor).toBe(extensionContext.extension.id);
          expect(contributions).toEqual([
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
          ]);
          expect(
            existsSync(
              contributions[0].inferredProjectContribution?.manifest.exec[1] ??
                '',
            ),
          ).toBe(true);
        });

        it('keeps a single mapper registration', () => {
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
        });
      });

      describe('disposal', () => {
        it('releases the mapper registration', () => {
          extensionContext.subscriptions.forEach((subscription) =>
            subscription.dispose(),
          );
          expect(mocks.dispose).toHaveBeenCalledOnce();
        });
      });
    });

    context('when the FTS extension is disposed during activation', () => {
      describe('mapper registration', () => {
        it('does not register after activation finishes', async () => {
          const pending = Promise.withResolvers<unknown>();
          mocks.activate.mockReturnValue(pending.promise);
          const extensionContext = createExtensionContext();
          const activating = activate(extensionContext);
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
    });

    context('when an extension change overlaps activation', () => {
      beforeEach(async () => {
        const pending = Promise.withResolvers<unknown>();
        mocks.activate.mockReturnValue(pending.promise);
        const activating = activate(createExtensionContext());
        const changing = mocks.onDidChange.mock.calls[0][0]();
        pending.resolve({
          registerContentMappers: mocks.registerContentMappers,
        });
        await Promise.all([activating, changing]);
      });

      describe('mapper registration', () => {
        it('registers once after both activations finish', () => {
          expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
        });
      });
    });

    context('when the native TypeScript extension is removed', () => {
      beforeEach(async () => {
        await activate(createExtensionContext());
        mocks.getExtension.mockReturnValue(undefined);
        await mocks.onDidChange.mock.calls[0][0]();
      });

      describe('disposal', () => {
        it('releases the removed extension registration', () => {
          expect(mocks.dispose).toHaveBeenCalledOnce();
        });
      });

      context(
        'when the native TypeScript extension becomes available again',
        () => {
          beforeEach(async () => {
            mocks.getExtension.mockReturnValue({ activate: mocks.activate });
            await mocks.onDidChange.mock.calls[0][0]();
          });

          describe('mapper registration', () => {
            it('creates a new registration', () => {
              expect(mocks.registerContentMappers).toHaveBeenCalledTimes(2);
            });
          });
        },
      );
    });
  });

  context('when the native TypeScript extension is absent', () => {
    beforeEach(() => {
      mocks.getExtension.mockReturnValue(undefined);
    });

    describe('mapper registration', () => {
      it('does not contribute a mapper', async () => {
        await activate(createExtensionContext());
        expect(mocks.registerContentMappers).not.toHaveBeenCalled();
      });
    });

    context(
      'when the native TypeScript extension becomes available later',
      () => {
        beforeEach(async () => {
          await activate(createExtensionContext());
          mocks.getExtension.mockImplementation((id) =>
            id === 'TypeScriptTeam.native-preview'
              ? { activate: mocks.activate }
              : undefined,
          );
          mocks.activate.mockResolvedValue({
            registerContentMappers: mocks.registerContentMappers,
          });
          mocks.registerContentMappers.mockReturnValue({
            dispose: mocks.dispose,
          });
          await mocks.onDidChange.mock.calls[0][0]();
        });

        describe('mapper registration', () => {
          it('registers when the extension is discovered', () => {
            expect(mocks.registerContentMappers).toHaveBeenCalledOnce();
          });
        });
      },
    );
  });
});
