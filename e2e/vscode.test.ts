import assert from 'node:assert/strict';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Mocha, {
  afterEach,
  before,
  beforeEach,
  describe as context,
  describe,
  it,
} from 'mocha';
import type { ExtensionAPI, TypeScriptSDK } from 'typescript/vscode';
import {
  type CompletionList,
  commands,
  extensions,
  type Hover,
  type Location,
  type LocationLink,
  languages,
  Position,
  Range,
  type TextDocument,
  Uri,
  version,
  WorkspaceEdit,
  window,
  workspace,
} from 'vscode';

async function eventually<T>(
  read: () => T | PromiseLike<T>,
  check: (value: T) => void,
): Promise<T> {
  const deadline = Date.now() + 30000;
  let failure: unknown;
  while (Date.now() < deadline) {
    try {
      // Poll the next observable state only after the previous read completes.
      // eslint-disable-next-line no-await-in-loop
      const value = await read();
      check(value);
      return value;
    } catch (error) {
      failure = error;
    }
    // eslint-disable-next-line no-await-in-loop
    await delay(100);
  }
  throw failure;
}

async function replace(document: TextDocument, text: string): Promise<void> {
  const edit = new WorkspaceEdit();
  edit.replace(
    document.uri,
    new Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    ),
    text,
  );
  assert(await workspace.applyEdit(edit));
}

async function hover(
  document: TextDocument,
  position: Position,
  expected: string,
) {
  return eventually(
    () =>
      commands.executeCommand<Hover[]>(
        'vscode.executeHoverProvider',
        document.uri,
        position,
      ),
    (items) => {
      assert(
        items?.some((item) =>
          item.contents.some((content) =>
            (typeof content === 'string' ? content : content.value).includes(
              expected,
            ),
          ),
        ),
        `Expected hover containing ${expected}`,
      );
    },
  );
}

async function initialized(
  api: ExtensionAPI,
  accepts: (sdk: TypeScriptSDK) => boolean = () => true,
): Promise<TypeScriptSDK> {
  let subscription:
    | ReturnType<ExtensionAPI['onLanguageServerInitialized']>
    | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<TypeScriptSDK>((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('TypeScript SDK initialization timed out')),
        30000,
      );
      subscription = api.onLanguageServerInitialized((sdk) => {
        if (accepts(sdk)) resolve(sdk);
      });
    });
  } finally {
    clearTimeout(timer);
    subscription?.dispose();
  }
}

export async function run(): Promise<void> {
  const directory = process.env.FTS_VSIX_ACCEPTANCE_DIRECTORY;
  assert(
    directory,
    'The acceptance runner must provide its isolated directory',
  );
  const mode = process.env.FTS_VSIX_ACCEPTANCE_MODE;
  const source = readFileSync(join(directory, 'inferred/pipeline.fts'), 'utf8');
  const mocha = new Mocha({ timeout: 60000 });
  mocha.suite.emit('pre-require', globalThis, __filename, mocha);
  const observations: { name: string; error?: string }[] = [];
  let api: ExtensionAPI;
  let sdk: TypeScriptSDK;
  let document: TextDocument;

  async function selectSDK(path: string): Promise<TypeScriptSDK> {
    const selected = initialized(
      api,
      (candidate) => candidate.packageJsonPath === join(path, 'package.json'),
    );
    await workspace.getConfiguration('js/ts').update('tsdk.path', path, true);
    await commands.executeCommand('typescript.native-preview.restart');
    return selected;
  }

  describe('installed FTS VSIX', () => {
    before(async () => {
      assert.equal(version, '1.145.2');
      document = await workspace.openTextDocument(
        Uri.file(join(directory, 'inferred/pipeline.fts')),
      );
      await window.showTextDocument(document, { preview: false });
      const official = extensions.getExtension<ExtensionAPI>(
        'TypeScriptTeam.native-preview',
      );
      assert(official);
      assert.equal(official.packageJSON.version, '1.0.2');
      api = await official.activate();
      sdk = await initialized(api);
      assert.equal(sdk.version, mode === 'supported' ? '7.1.0-beta' : '7.0.2');
      const extension = extensions.getExtension('ftslang.ftslang-vscode');
      assert(extension);
      const installedPath = relative(
        join(directory, 'extensions'),
        extension.extensionPath,
      );
      assert(
        !installedPath.startsWith(`..${sep}`),
        `FTS must load from the installed VSIX: ${extension.extensionPath}`,
      );
      await extension.activate();
      assert.equal(document.languageId, 'future-typescript');
    });

    if (mode === 'supported') {
      context('when a loose FTS file uses the selected SDK', () => {
        beforeEach(async () => {
          await replace(document, source);
        });
        afterEach(async () => {
          await replace(document, source);
        });

        it('provides hover, completion, navigation and a mapped type error', async () => {
          await hover(document, new Position(0, 14), 'result: number');
          await eventually(
            () => languages.getDiagnostics(document.uri),
            (diagnostics) => {
              const error = diagnostics.find(
                (diagnostic) => diagnostic.code === 2322,
              );
              assert(error);
              assert.equal(document.getText(error.range), 'broken');
            },
          );
          await eventually(
            () =>
              commands.executeCommand<(Location | LocationLink)[]>(
                'vscode.executeDefinitionProvider',
                document.uri,
                new Position(1, 22),
              ),
            (locations) => {
              assert(
                locations?.some((location) => {
                  const uri =
                    'uri' in location ? location.uri : location.targetUri;
                  const range =
                    'range' in location
                      ? location.range
                      : location.targetSelectionRange;
                  return (
                    uri.toString() === document.uri.toString() &&
                    document.getText(range) === 'result'
                  );
                }),
              );
            },
          );
          await replace(document, `${source}\n1 |> Ma`);
          await eventually(
            () =>
              commands.executeCommand<CompletionList>(
                'vscode.executeCompletionItemProvider',
                document.uri,
                document.positionAt(document.getText().length),
              ),
            (completion) => {
              assert(
                completion?.items.some(
                  (item) =>
                    (typeof item.label === 'string'
                      ? item.label
                      : item.label.label) === 'Math',
                ),
              );
            },
          );
        });

        it('removes and restores the diagnostic as the source changes', async () => {
          await eventually(
            () => languages.getDiagnostics(document.uri),
            (items) => assert(items.some((item) => item.code === 2322)),
          );
          await replace(document, source.replace('"wrong"', '1'));
          await eventually(
            () => languages.getDiagnostics(document.uri),
            (items) => assert.equal(items.length, 0),
          );
          await replace(document, source);
          await eventually(
            () => languages.getDiagnostics(document.uri),
            (items) => assert(items.some((item) => item.code === 2322)),
          );
        });
      });

      context('when a configured consumer imports an FTS module', () => {
        let consumer: TextDocument;
        before(async () => {
          consumer = await workspace.openTextDocument(
            Uri.file(join(directory, 'consumer/src/index.ts')),
          );
          await window.showTextDocument(consumer, { preview: false });
        });

        it('reports the imported type and navigates to the original FTS declaration', async () => {
          await hover(consumer, new Position(0, 10), 'result: number');
          await eventually(
            () => languages.getDiagnostics(consumer.uri),
            (items) => assert(items.some((item) => item.code === 2322)),
          );
          await eventually(
            () =>
              commands.executeCommand<(Location | LocationLink)[]>(
                'vscode.executeDefinitionProvider',
                consumer.uri,
                new Position(0, 10),
              ),
            (locations) => {
              assert(
                locations?.some(
                  (location) =>
                    ('uri' in location ? location.uri : location.targetUri)
                      .fsPath === join(directory, 'consumer/src/pipeline.fts'),
                ),
              );
            },
          );
        });
      });

      context('when the selected SDK moves to another installation', () => {
        it('uses the new SDK for syntax recovery even after the former installation is removed', async () => {
          const next = await selectSDK(
            join(directory, 'SDK with spaces/node_modules/typescript'),
          );
          assert(next.isCurrent());
          assert(!sdk.isCurrent());
          sdk = next;
          const previous = join(directory, 'consumer/node_modules/typescript');
          renameSync(previous, `${previous}.previous`);
          try {
            await replace(
              document,
              `${source}\nexport function parse<T>(value: T): T { return value |> ; }`,
            );
            await eventually(
              () => languages.getDiagnostics(document.uri),
              (items) => assert(items.some((item) => item.code === 1000)),
            );
            // Syntax recovery preserves exports but has no editable span map.
            // Check editor hover again after the incomplete source is repaired.
            await replace(document, source);
            await hover(document, new Position(0, 14), 'result: number');
          } finally {
            renameSync(`${previous}.previous`, previous);
            await replace(document, source);
          }
        });
      });
    } else {
      context(
        'when the official extension initially uses its unsupported default SDK',
        () => {
          it('keeps the language available and becomes functional after the user selects a supported SDK', async () => {
            const config = workspace.getConfiguration('js/ts');
            assert.equal(config.inspect('tsdk.path')?.globalValue, undefined);
            assert.equal(document.languageId, 'future-typescript');
            assert.equal(
              (
                await commands.executeCommand<Hover[]>(
                  'vscode.executeHoverProvider',
                  document.uri,
                  new Position(0, 14),
                )
              )?.length ?? 0,
              0,
            );
            sdk = await selectSDK(
              join(directory, 'consumer/node_modules/typescript'),
            );
            await hover(document, new Position(0, 14), 'result: number');
            await eventually(
              () => languages.getDiagnostics(document.uri),
              (items) => assert(items.some((item) => item.code === 2322)),
            );
          });
        },
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    const runner = mocha.run((failures) => {
      writeFileSync(
        join(directory, `${mode}.json`),
        JSON.stringify(
          {
            vscode: version,
            node: process.versions.node,
            platform: process.platform,
            arch: process.arch,
            sdk: sdk?.version,
            sdkPath: sdk?.packageJsonPath,
            failures,
            observations,
          },
          null,
          2,
        ),
      );
      if (failures)
        reject(
          new Error(`${failures} installed VSIX acceptance test(s) failed`),
        );
      else resolve();
    });
    runner.on('pass', (test) => observations.push({ name: test.fullTitle() }));
    runner.on('fail', (test, error) =>
      observations.push({
        name: test.fullTitle(),
        error: error.stack ?? error.message,
      }),
    );
  });
}
