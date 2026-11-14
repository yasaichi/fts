import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
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

describe('FTS editor integration', () => {
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

      it('hides the synthesized topic from hover', async () => {
        expect(
          await connection.sendRequest('textDocument/hover', {
            textDocument: { uri },
            position: positionAt(source, source.lastIndexOf('%')),
          }),
        ).toBeNull();
      });
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

    describe('textDocument/diagnostic', () => {
      it('projects the FTS type error to its original range', async () => {
        const expected = baseline.files.find(
          ({ file }) => file === 'pipeline.fts',
        );
        const report = await connection.sendRequest<{ items: Diagnostic[] }>(
          'textDocument/diagnostic',
          { textDocument: { uri } },
        );
        const errors = report.items
          .filter(({ severity }) => severity === 1)
          .map(({ code, range }) => ({ code, range }));
        expect(errors).toEqual(expected?.diagnostics);
      });
    });
  });

  context('when source ends inside an unfinished pipeline stage', () => {
    const fileUri = new URL(
      './fixtures/parity/incomplete-pipeline.fts',
      import.meta.url,
    ).href;
    const text = readFileSync(fileURLToPath(fileUri), 'utf8').trimEnd();

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

  context('when a consumer imports an incomplete producer', () => {
    let directory: string;
    let consumerUri: string;
    let producerUri: string;
    const incomplete = 'export const broken = 1 |> String(';
    const repaired = 'export const broken = 1 |> String(%);';
    const text = `import { broken } from "./broken.fts";
export const result = broken;`;

    beforeEach(async () => {
      directory = mkdtempSync(
        join(
          fileURLToPath(new URL('./fixtures/parity/', import.meta.url)),
          '.recovery-',
        ),
      );
      const consumer = join(directory, 'consumer.ts');
      const producer = join(directory, 'broken.fts');
      consumerUri = pathToFileURL(consumer).href;
      producerUri = pathToFileURL(producer).href;
      writeFileSync(
        join(directory, 'tsconfig.json'),
        JSON.stringify({
          extends: '../tsconfig.json',
          files: ['consumer.ts', 'broken.fts'],
          include: [],
        }),
      );
      writeFileSync(producer, incomplete);
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

    afterEach(async () => {
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

    describe('producer recovery', () => {
      it('preserves imports while editing and restores types after repair', async () => {
        const before = await connection.sendRequest<{ items: Diagnostic[] }>(
          'textDocument/diagnostic',
          { textDocument: { uri: producerUri } },
        );
        expect(before.items).toContainEqual(
          expect.objectContaining({ code: 1000, source: 'fts' }),
        );
        const consumerBefore = await connection.sendRequest<{
          items: Diagnostic[];
        }>('textDocument/diagnostic', { textDocument: { uri: consumerUri } });
        expect(
          consumerBefore.items.filter(({ severity }) => severity === 1),
        ).toEqual([]);

        await connection.sendNotification('textDocument/didChange', {
          textDocument: { uri: producerUri, version: 2 },
          contentChanges: [{ text: repaired }],
        });

        const after = await connection.sendRequest<{ items: Diagnostic[] }>(
          'textDocument/diagnostic',
          { textDocument: { uri: producerUri } },
        );
        expect(after.items.filter(({ severity }) => severity === 1)).toEqual(
          [],
        );
        const consumerAfter = await connection.sendRequest<{
          items: Diagnostic[];
        }>('textDocument/diagnostic', { textDocument: { uri: consumerUri } });
        expect(
          consumerAfter.items.filter(({ severity }) => severity === 1),
        ).toEqual([]);
        const hover = await connection.sendRequest<{
          contents: { value: string };
        }>('textDocument/hover', {
          textDocument: { uri: consumerUri },
          position: positionAt(text, text.indexOf('result')),
        });
        expect(hover.contents.value).toContain('result: string');
      });
    });
  });
});
