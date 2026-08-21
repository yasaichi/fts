import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
import { URI } from 'vscode-uri';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface Diagnostic {
  message: string;
  range: Range;
}

interface Hover {
  contents: string | { value: string } | Array<string | { value: string }>;
}

interface LanguageServerFixture {
  diagnostics: Promise<Diagnostic[]>;
  errors: string[];
  hoverAt(position: Position): Promise<Hover | null>;
  source: string;
  stop(): Promise<void>;
}

interface Position {
  character: number;
  line: number;
}

interface Range {
  end: Position;
  start: Position;
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const fixturePath = path.join(repositoryRoot, 'examples', 'pipeline.fts');
const fixtureUri = URI.file(fixturePath).toString();
const workspaceUri = URI.file(path.dirname(fixturePath)).toString();

describe('Future TypeScript language server', () => {
  describe('when a pipeline document is open', () => {
    let server: LanguageServerFixture;

    beforeAll(async () => {
      server = await startLanguageServer();
    });

    afterAll(async () => {
      await server.stop();
      expect(server.errors).toEqual([]);
    });

    describe('textDocument/hover', () => {
      it('returns the inferred result type', async () => {
        const hover = await server.hoverAt({ character: 8, line: 4 });

        expect(hover).not.toBeNull();
        expect(hoverText(hover!)).toContain('result: string');
      });

      it.each([
        { character: 16, position: 'start' },
        { character: 17, position: 'end' },
      ])(
        'does not expose generated names at the topic $position',
        async ({ character }) => {
          const hover = await server.hoverAt({ character, line: 11 });

          if (hover) {
            expect(hoverText(hover)).not.toContain('_ref2');
          }
        },
      );
    });

    describe('textDocument/publishDiagnostics', () => {
      it('maps the type error to the original topic token', async () => {
        const diagnostics = await server.diagnostics;
        const diagnostic = diagnostics[0]!;

        expect(diagnostics).toHaveLength(1);
        expect(diagnostic.message).toContain(
          "Argument of type '{ id: number; }' is not assignable to parameter of type 'number'",
        );
        expect(diagnostic.range.start.line).toBe(11);
        expect(textInRange(server.source, diagnostic.range)).toBe('%');
      });
    });
  });
});

function hoverText(hover: Hover): string {
  const contents = Array.isArray(hover.contents)
    ? hover.contents
    : [hover.contents];
  return contents
    .map((content) => (typeof content === 'string' ? content : content.value))
    .join('\n');
}

async function startLanguageServer(): Promise<LanguageServerFixture> {
  const child = spawn(
    process.execPath,
    ['--import=tsx', 'src/server.ts', '--stdio'],
    {
      cwd: repositoryRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  const errors: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
  connection.onError((error) => errors.push(String(error)));
  connection.onRequest('client/registerCapability', () => null);
  connection.onRequest('workspace/configuration', () => []);
  connection.onRequest('workspace/workspaceFolders', () => [
    { name: 'examples', uri: workspaceUri },
  ]);
  connection.listen();

  await initialize(connection);

  const source = await readFile(fixturePath, 'utf8');
  const diagnostics = waitForDiagnostics(connection, fixtureUri);
  connection.sendNotification('textDocument/didOpen', {
    textDocument: {
      languageId: 'future-typescript',
      text: source,
      uri: fixtureUri,
      version: 1,
    },
  });

  return {
    diagnostics,
    errors,
    hoverAt(position) {
      return connection.sendRequest<Hover | null>('textDocument/hover', {
        position,
        textDocument: { uri: fixtureUri },
      });
    },
    source,
    stop: () => stopServer(connection, child),
  };
}

async function initialize(connection: MessageConnection): Promise<void> {
  await connection.sendRequest('initialize', {
    capabilities: {
      textDocument: {
        hover: { contentFormat: ['markdown', 'plaintext'] },
        publishDiagnostics: { relatedInformation: true },
      },
      workspace: {
        configuration: false,
        didChangeWatchedFiles: { dynamicRegistration: false },
        workspaceFolders: true,
      },
    },
    clientInfo: { name: 'future-typescript-test', version: '0.0.1' },
    processId: process.pid,
    rootUri: workspaceUri,
    workspaceFolders: [{ name: 'examples', uri: workspaceUri }],
  });
  connection.sendNotification('initialized', {});
}

async function stopServer(
  connection: MessageConnection,
  child: ChildProcessWithoutNullStreams,
): Promise<void> {
  try {
    await connection.sendRequest('shutdown');
    connection.sendNotification('exit');
  } finally {
    connection.dispose();
    if (!child.killed) {
      child.kill();
    }
  }
}

function textInRange(source: string, range: Range): string {
  return source.slice(
    offsetAt(source, range.start),
    offsetAt(source, range.end),
  );
}

function offsetAt(source: string, position: Position): number {
  const lineOffsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      lineOffsets.push(index + 1);
    }
  }
  return lineOffsets[position.line]! + position.character;
}

function waitForDiagnostics(
  connection: MessageConnection,
  uri: string,
): Promise<Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for diagnostics')),
      10_000,
    );
    const disposable = connection.onNotification(
      'textDocument/publishDiagnostics',
      (params: { diagnostics: Diagnostic[]; uri: string }) => {
        if (params.uri === uri && params.diagnostics.length > 0) {
          clearTimeout(timeout);
          disposable.dispose();
          resolve(params.diagnostics);
        }
      },
    );
  });
}
