import {
  startLanguageServer,
  type LanguageServerHandle,
} from '@volar/test-utils';
import { fileURLToPath } from 'node:url';
import {
  afterAll,
  beforeAll,
  describe,
  describe as context,
  expect,
  it,
} from 'vitest';

describe('Future TypeScript language server', () => {
  let document: Awaited<ReturnType<LanguageServerHandle['openTextDocument']>>;
  let server: LanguageServerHandle;

  beforeAll(async () => {
    const repository = new URL('../../../', import.meta.url);
    server = startLanguageServer(
      fileURLToPath(new URL('../bin/fts-language-server.cjs', import.meta.url)),
      repository,
    );

    await server.initialize(repository.href, {});
  });

  afterAll(async () => {
    try {
      await server.shutdown();
    } finally {
      server.process.kill();
    }
  });

  context('with a pipeline document', () => {
    beforeAll(async () => {
      document = await server.openTextDocument(
        fileURLToPath(
          new URL('../../../examples/pipeline.fts', import.meta.url),
        ),
        'future-typescript',
      );
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

  context('with an incomplete pipeline document', () => {
    beforeAll(async () => {
      document = await server.openTextDocument(
        fileURLToPath(
          new URL('./fixtures/incomplete-pipeline.fts', import.meta.url),
        ),
        'future-typescript',
      );
    });

    describe('textDocument/completion', () => {
      it('completes an identifier in an unfinished pipeline stage', async () => {
        const mathCompletion = (
          await server.sendCompletionRequest(
            document.uri,
            document.positionAt(document.getText().trimEnd().length),
          )
        )?.items.find(({ label }) => label === 'Math');

        expect(
          mathCompletion?.textEdit?.newText ??
            mathCompletion?.insertText ??
            mathCompletion?.label,
        ).toBe('Math');
      });
    });
  });
});
