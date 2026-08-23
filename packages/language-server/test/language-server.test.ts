import {
  startLanguageServer,
  type LanguageServerHandle,
} from '@volar/test-utils';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Future TypeScript language server', () => {
  const workspace = new URL('../../../examples/', import.meta.url);
  let server: LanguageServerHandle;
  let document: Awaited<
    ReturnType<LanguageServerHandle['openTextDocument']>
  >;

  beforeAll(async () => {
    server = startLanguageServer(
      fileURLToPath(
        new URL('../bin/fts-language-server.cjs', import.meta.url),
      ),
      new URL('../../../', import.meta.url),
    );
    await server.initialize(workspace.href, {});

    document = await server.openTextDocument(
      fileURLToPath(new URL('pipeline.fts', workspace)),
      'future-typescript',
    );
  });

  afterAll(async () => {
    try {
      await server.shutdown();
    } finally {
      server.process.kill();
    }
  });

  describe('textDocument/hover', () => {
    it('returns the inferred result type', async () => {
      const hover = await server.sendHoverRequest(
        document.uri,
        document.positionAt(document.getText().indexOf('result')),
      );

      expect(hover).toMatchObject({
        contents: {
          value: expect.stringContaining('result: string'),
        },
      });
    });

    it.each([
      { adjustment: 0, position: 'start' },
      { adjustment: 1, position: 'end' },
    ])(
      'does not provide a semantic hover at the topic $position',
      async ({ adjustment }) => {
        const hover = await server.sendHoverRequest(
          document.uri,
          document.positionAt(
            document.getText().lastIndexOf('%') + adjustment,
          ),
        );

        expect(hover).toBeNull();
      },
    );
  });

  describe('textDocument/diagnostic', () => {
    it('maps the type error to the original topic token', async () => {
      const topicOffset = document.getText().lastIndexOf('%');
      const diagnosticReport = await server.sendDocumentDiagnosticRequest(
        document.uri,
      );

      expect(diagnosticReport).toEqual({
        kind: 'full',
        items: [
          expect.objectContaining({
            message: expect.stringContaining(
              "not assignable to parameter of type 'number'",
            ),
            range: {
              end: document.positionAt(topicOffset + 1),
              start: document.positionAt(topicOffset),
            },
          }),
        ],
      });
    });
  });
});
