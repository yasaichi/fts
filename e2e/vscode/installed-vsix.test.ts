import assert from 'node:assert/strict';
import { readFileSync, renameSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  afterEach,
  before,
  beforeEach,
  describe as context,
  describe,
  it,
} from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
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

async function hover(
  document: TextDocument,
  position: Position,
  expected: string,
) {
  return waitForAssertion(async () => {
    const items = await commands.executeCommand<Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      position,
    );
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
  });
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

// Language features arrive after the server processes editor changes. Retry the
// assertion so a timeout reports its last actual failure, rather than a delay.
async function waitForAssertion(
  assertion: () => void | PromiseLike<void>,
): Promise<void> {
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      // Each assertion must observe the state after the preceding attempt.
      // eslint-disable-next-line no-await-in-loop
      return await assertion();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    // eslint-disable-next-line no-await-in-loop
    await delay(100);
  }
}

// Retain the SDK observed by the suite for the acceptance environment report.
export let sdk: TypeScriptSDK | undefined;

describe('installed FTS VSIX', () => {
  const directory = process.env.FTS_VSIX_ACCEPTANCE_DIRECTORY;
  assert(
    directory,
    'The acceptance runner must provide its isolated directory',
  );
  const mode = process.env.FTS_VSIX_ACCEPTANCE_MODE;
  const source = readFileSync(join(directory, 'inferred/pipeline.fts'), 'utf8');
  let api: ExtensionAPI;
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

  before(async () => {
    assert.equal(version, process.env.FTS_VSCODE_VERSION);
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
        await waitForAssertion(() => {
          const diagnostics = languages.getDiagnostics(document.uri);
          const error = diagnostics.find(
            (diagnostic) => diagnostic.code === 2322,
          );
          assert(error);
          assert.equal(document.getText(error.range), 'broken');
        });
        await waitForAssertion(async () => {
          const locations = await commands.executeCommand<
            (Location | LocationLink)[]
          >(
            'vscode.executeDefinitionProvider',
            document.uri,
            new Position(1, 22),
          );
          assert(
            locations?.some((location) => {
              const uri = 'uri' in location ? location.uri : location.targetUri;
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
        });
        await replace(document, `${source}\n1 |> Ma`);
        await waitForAssertion(async () => {
          const completion = await commands.executeCommand<CompletionList>(
            'vscode.executeCompletionItemProvider',
            document.uri,
            document.positionAt(document.getText().length),
          );
          assert(
            completion?.items.some(
              (item) =>
                (typeof item.label === 'string'
                  ? item.label
                  : item.label.label) === 'Math',
            ),
          );
        });
      });

      it('removes and restores the diagnostic as the source changes', async () => {
        await waitForAssertion(() => {
          const items = languages.getDiagnostics(document.uri);
          assert(items.some((item) => item.code === 2322));
        });
        await replace(document, source.replace('"wrong"', '1'));
        await waitForAssertion(() => {
          const items = languages.getDiagnostics(document.uri);
          assert.equal(items.length, 0);
        });
        await replace(document, source);
        await waitForAssertion(() => {
          const items = languages.getDiagnostics(document.uri);
          assert(items.some((item) => item.code === 2322));
        });
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
        await waitForAssertion(() => {
          const items = languages.getDiagnostics(consumer.uri);
          assert(items.some((item) => item.code === 2322));
        });
        await waitForAssertion(async () => {
          const locations = await commands.executeCommand<
            (Location | LocationLink)[]
          >(
            'vscode.executeDefinitionProvider',
            consumer.uri,
            new Position(0, 10),
          );
          assert(
            locations?.some(
              (location) =>
                ('uri' in location ? location.uri : location.targetUri)
                  .fsPath === join(directory, 'consumer/src/pipeline.fts'),
            ),
          );
        });
      });
    });

    context('when the selected SDK moves to another installation', () => {
      it('uses the new SDK for syntax recovery even after the former installation is removed', async () => {
        const next = await selectSDK(
          join(directory, 'SDK with spaces/node_modules/typescript'),
        );
        assert(next.isCurrent());
        assert(sdk && !sdk.isCurrent());
        sdk = next;
        const previous = join(directory, 'consumer/node_modules/typescript');
        renameSync(previous, `${previous}.previous`);
        try {
          await replace(
            document,
            `${source}\nexport function parse<T>(value: T): T { return value |> ; }`,
          );
          await waitForAssertion(() => {
            const items = languages.getDiagnostics(document.uri);
            assert(items.some((item) => item.code === 1000));
          });
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
          await waitForAssertion(() => {
            const items = languages.getDiagnostics(document.uri);
            assert(items.some((item) => item.code === 2322));
          });
        });
      },
    );
  }
});
