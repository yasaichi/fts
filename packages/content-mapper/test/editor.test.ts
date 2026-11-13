import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  afterAll,
  beforeAll,
  describe as context,
  describe,
  expect,
  it,
} from 'vitest';
import { startConnection, tsc } from './connection.js';
import baseline from './fixtures/parity/volar-baseline.json' with {
  type: 'json',
};

interface Position {
  character: number;
  line: number;
}
interface Range {
  end: Position;
  start: Position;
}
interface Diagnostic {
  code: number;
  range: Range;
  severity: number;
}

function positionAt(source: string, offset: number): Position {
  const prefix = source.slice(0, offset);
  return {
    character: offset - prefix.lastIndexOf('\n') - 1,
    line: prefix.split('\n').length - 1,
  };
}

// This is the same native server used by the TypeScript VS Code extension;
// no FTS language server or semantic provider participates in these requests.

describe('native TypeScript editor features', () => {
  let server: ReturnType<typeof startConnection>;
  let connection: ReturnType<typeof startConnection>['connection'];

  beforeAll(async () => {
    server = startConnection(process.execPath, [tsc, '--lsp', '--stdio']);
    connection = server.connection;
    connection.onRequest(
      'workspace/configuration',
      ({ items }: { items: unknown[] }) => items.map(() => ({})),
    );
    connection.onRequest('client/registerCapability', () => null);
    connection.onRequest('workspace/diagnostic/refresh', () => null);
    await connection.sendRequest('initialize', {
      processId: process.pid,
      initializationOptions: { runExternalCode: true },
      rootUri: new URL('../../../', import.meta.url).href,
      workspaceFolders: [
        { uri: new URL('../../../', import.meta.url).href, name: 'fts' },
      ],
      capabilities: {
        general: { positionEncodings: ['utf-16'] },
        textDocument: {
          diagnostic: {},
          completion: { completionItem: { snippetSupport: true } },
        },
      },
    });
    await connection.sendNotification('initialized', {});
  });

  afterAll(() => server.stop());

  context('when source contains a complete pipeline', () => {
    const uri = new URL('./fixtures/parity/pipeline.fts', import.meta.url).href;
    const source = readFileSync(fileURLToPath(uri), 'utf8');

    beforeAll(async () => {
      await connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'future-typescript',
          version: 1,
          text: source,
        },
      });
    });

    afterAll(async () => {
      await connection.sendNotification('textDocument/didClose', {
        textDocument: { uri },
      });
    });

    describe('textDocument/hover', () => {
      it('provides the inferred hover type in the original source', async () => {
        const hover = await connection.sendRequest<{
          contents: { value: string };
          range: Range;
        }>('textDocument/hover', {
          textDocument: { uri },
          position: positionAt(source, source.indexOf('result')),
        });
        expect(hover.contents.value).toContain('result: string');
        expect(hover.range).toEqual({
          start: positionAt(source, source.indexOf('result')),
          end: positionAt(source, source.indexOf('result') + 'result'.length),
        });
      });

      it.each([0, 1])(
        'hides synthesized topics from hover at offset %i',
        async (adjustment) => {
          expect(
            await connection.sendRequest('textDocument/hover', {
              textDocument: { uri },
              position: positionAt(
                source,
                source.lastIndexOf('%') + adjustment,
              ),
            }),
          ).toBeNull();
        },
      );
    });

    describe('textDocument/definition', () => {
      it('jumps from a pipeline call to its original declaration', async () => {
        const definition = await connection.sendRequest<
          { uri: string; range: Range }[]
        >('textDocument/definition', {
          textDocument: { uri },
          position: positionAt(source, source.lastIndexOf('parse')),
        });
        expect(definition).toContainEqual(
          expect.objectContaining({
            uri,
            range: {
              start: { line: 1, character: 17 },
              end: { line: 1, character: 22 },
            },
          }),
        );
      });
    });
  });

  context('when source ends inside an unfinished pipeline stage', () => {
    const fileUri = new URL(
      './fixtures/parity/incomplete-pipeline.fts',
      import.meta.url,
    ).href;
    const text = readFileSync(fileURLToPath(fileUri), 'utf8');

    beforeAll(async () => {
      await connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: fileUri,
          languageId: 'future-typescript',
          version: 1,
          text,
        },
      });
    });

    afterAll(async () => {
      await connection.sendNotification('textDocument/didClose', {
        textDocument: { uri: fileUri },
      });
    });

    describe('textDocument/completion', () => {
      it('completes Math in an unfinished pipeline stage', async () => {
        const completion = await connection.sendRequest<{
          items: {
            label: string;
            insertText?: string;
            textEdit?: { newText: string };
          }[];
        }>('textDocument/completion', {
          textDocument: { uri: fileUri },
          position: positionAt(text, text.trimEnd().length),
        });
        const math = completion.items.find(({ label }) => label === 'Math');
        expect(math?.textEdit?.newText ?? math?.insertText ?? math?.label).toBe(
          'Math',
        );
      });
    });
  });

  context.each(baseline.files)(
    'when checking $file',
    ({ file, diagnostics }) => {
      const fileUri = new URL('./fixtures/parity/' + file, import.meta.url)
        .href;
      const text = readFileSync(fileURLToPath(fileUri), 'utf8');

      beforeAll(async () => {
        await connection.sendNotification('textDocument/didOpen', {
          textDocument: {
            uri: fileUri,
            languageId: 'future-typescript',
            version: 1,
            text,
          },
        });
      });

      afterAll(async () => {
        await connection.sendNotification('textDocument/didClose', {
          textDocument: { uri: fileUri },
        });
      });

      describe('textDocument/diagnostic', () => {
        it('preserves the complete pre-migration diagnostic ranges and codes', async () => {
          const report = await connection.sendRequest<{ items: Diagnostic[] }>(
            'textDocument/diagnostic',
            { textDocument: { uri: fileUri } },
          );
          const errors = report.items
            .filter(({ severity }) => severity === 1)
            .map(({ code, range }) => ({ code, range }));
          expect(errors).toEqual(expect.arrayContaining(diagnostics));
          expect(errors).toHaveLength(diagnostics.length);
        });
      });
    },
  );

  context('when a project has no tsconfig', () => {
    let directory: string;
    let inferredUri: string;
    const text =
      'export const result = 1 |> % + 1;\nexport const broken: number = "wrong";';

    beforeAll(async () => {
      directory = mkdtempSync(join(tmpdir(), 'fts-inferred-'));
      const fileName = join(directory, 'inferred.fts');
      writeFileSync(fileName, text);
      inferredUri = pathToFileURL(fileName).href;
      await connection.sendRequest('custom/setContentMapperContributions', {
        contributions: [
          {
            contributorId: 'test.ftslang-vscode',
            extensions: ['.fts'],
            inferredProjectContribution: {
              manifest: {
                name: '@ftslang/content-mapper',
                version: '0.0.1',
                exec: [
                  process.execPath,
                  fileURLToPath(new URL('../dist/mapper.cjs', import.meta.url)),
                ],
                cwd: fileURLToPath(new URL('../', import.meta.url)),
                compilerOptions: [],
                dynamicConfig: false,
              },
            },
          },
        ],
        openDocuments: [],
      });
      await connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: inferredUri,
          languageId: 'future-typescript',
          version: 1,
          text,
        },
      });
    });

    afterAll(async () => {
      try {
        await connection.sendNotification('textDocument/didClose', {
          textDocument: { uri: inferredUri },
        });
        await connection.sendRequest('custom/setContentMapperContributions', {
          contributions: [],
          openDocuments: [],
        });
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    });

    describe('textDocument/hover', () => {
      it('uses the contributed mapper to infer the result type', async () => {
        const hover = await connection.sendRequest<{
          contents: { value: string };
        }>('textDocument/hover', {
          textDocument: { uri: inferredUri },
          position: positionAt(text, text.indexOf('result')),
        });
        expect(hover.contents.value).toContain('result: number');
      });
    });

    describe('textDocument/diagnostic', () => {
      it('reports the original source type error', async () => {
        const diagnostics = await connection.sendRequest<{
          items: Diagnostic[];
        }>('textDocument/diagnostic', { textDocument: { uri: inferredUri } });
        expect(
          diagnostics.items
            .filter(({ severity }) => severity === 1)
            .map(({ code }) => code),
        ).toEqual([2322]);
      });
    });
  });

  context('when a consumer imports a module that cannot be lowered', () => {
    let directory: string;
    let consumerUri: string;
    let producerUri: string;
    const declarations = `declare const input: any;
      export const named = 1;
      export const { key: renamed, nested: { inner } } = input;
      export function fn<T>(value: T): T { return value; }
      export class Model<T> { value?: T }
      export interface Shape<T> { value: T }
      export type Result<T> = T;
      export namespace Models { export interface Shape { id: number } }
      export enum State { Ready }
      export { named as alias };
      export default named;
      export type * from "./other.fts";`;
    const incomplete = `${declarations}\nexport const broken = input |> parse(`;
    const repaired = `${declarations}\nexport const broken = 1 |> String(%);`;
    const text = `import value, { alias, broken, fn, inner, Model, Models, named, renamed, State } from "./broken.fts";
    import type { Other, Result, Shape } from "./broken.fts";
    export const model: Model<string> = new Model<string>();
    export const shape: Models.Shape = { id: 1 };
    export const state: State.Ready = State.Ready;
    export const types: [Other, Result<string>, Shape<number>] = [{ value: named }, "ok", { value }];
    export const values = [alias, broken, fn<string>("ok"), inner, renamed];
    export const result = broken;`;

    beforeAll(async () => {
      directory = mkdtempSync(
        join(
          fileURLToPath(new URL('./fixtures/parity/', import.meta.url)),
          '.recovery-',
        ),
      );
      const consumer = join(directory, 'consumer.ts');
      consumerUri = pathToFileURL(consumer).href;
      writeFileSync(
        join(directory, 'tsconfig.json'),
        JSON.stringify({
          extends: '../tsconfig.json',
          files: ['consumer.ts', 'broken.fts', 'other.fts'],
          include: [],
        }),
      );
      const producer = join(directory, 'broken.fts');
      producerUri = pathToFileURL(producer).href;
      writeFileSync(producer, incomplete);
      writeFileSync(
        join(directory, 'other.fts'),
        'export interface Other { value: number }',
      );
      writeFileSync(consumer, text);
      await connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: consumerUri,
          languageId: 'typescript',
          version: 1,
          text,
        },
      });
      await connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: producerUri,
          languageId: 'future-typescript',
          version: 1,
          text: incomplete,
        },
      });
    });

    afterAll(async () => {
      try {
        await connection.sendNotification('textDocument/didClose', {
          textDocument: { uri: consumerUri },
        });
        await connection.sendNotification('textDocument/didClose', {
          textDocument: { uri: producerUri },
        });
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    });

    describe('textDocument/diagnostic', () => {
      it('reports the producer frontend error', async () => {
        const report = await connection.sendRequest<{ items: Diagnostic[] }>(
          'textDocument/diagnostic',
          { textDocument: { uri: producerUri } },
        );
        expect(report.items).toContainEqual(
          expect.objectContaining({ code: 1000 }),
        );
      });

      it('keeps value and type exports importable in the consumer', async () => {
        const report = await connection.sendRequest<{ items: Diagnostic[] }>(
          'textDocument/diagnostic',
          { textDocument: { uri: consumerUri } },
        );
        expect(report.items.filter(({ severity }) => severity === 1)).toEqual(
          [],
        );
      });
    });

    context('when the producer is repaired', () => {
      beforeAll(async () => {
        await connection.sendNotification('textDocument/didChange', {
          textDocument: { uri: producerUri, version: 2 },
          contentChanges: [{ text: repaired }],
        });
      });

      describe('textDocument/hover', () => {
        it('restores the consumer type from the repaired producer', async () => {
          const hover = await connection.sendRequest<{
            contents: { value: string };
          }>('textDocument/hover', {
            textDocument: { uri: consumerUri },
            position: positionAt(text, text.indexOf('result')),
          });
          expect(hover.contents.value).toContain('result: string');
        });
      });

      describe('textDocument/diagnostic', () => {
        it('clears the producer diagnostics', async () => {
          const report = await connection.sendRequest<{ items: Diagnostic[] }>(
            'textDocument/diagnostic',
            { textDocument: { uri: producerUri } },
          );
          expect(report.items.filter(({ severity }) => severity === 1)).toEqual(
            [],
          );
        });

        it('keeps the consumer free of cascading diagnostics', async () => {
          const report = await connection.sendRequest<{ items: Diagnostic[] }>(
            'textDocument/diagnostic',
            { textDocument: { uri: consumerUri } },
          );
          expect(report.items.filter(({ severity }) => severity === 1)).toEqual(
            [],
          );
        });
      });
    });
  });
});
