import { fileURLToPath } from 'node:url';
import {
  afterAll,
  beforeAll,
  describe as context,
  describe,
  expect,
  it,
} from 'vitest';
import type { TransformResult } from '../src/transform.js';
import { startConnection } from './connection.js';

describe('content mapper stdio protocol', () => {
  let server: ReturnType<typeof startConnection>;
  let connection: ReturnType<typeof startConnection>['connection'];

  beforeAll(async () => {
    server = startConnection(process.execPath, [
      fileURLToPath(new URL('../dist/mapper.cjs', import.meta.url)),
    ]);
    connection = server.connection;
    await connection.sendRequest('initialize', {
      positionEncodings: ['utf-16'],
    });
  });

  afterAll(() => server.stop());

  describe('initialize', () => {
    context('when UTF-16 positions are supported', () => {
      describe('result', () => {
        it('selects UTF-16 and identifies its diagnostics', async () => {
          expect(
            await connection.sendRequest('initialize', {
              positionEncodings: ['utf-8', 'utf-16'],
            }),
          ).toEqual({ diagnosticSource: 'fts', positionEncoding: 'utf-16' });
        });
      });
    });

    context('when UTF-16 positions are not supported', () => {
      it('rejects the unsupported position encoding', async () => {
        await expect(
          connection.sendRequest('initialize', {
            positionEncodings: ['utf-8'],
          }),
        ).rejects.toThrow('FTS requires UTF-16');
      });
    });
  });

  describe('project lifecycle', () => {
    context('when multiple independent projects are opened', () => {
      it('isolates project handles and releases a closed project', async () => {
        expect(
          await Promise.all(
            ['one', 'two'].map((projectHandle) =>
              connection.sendRequest('openProject', {
                compilerOptions: {},
                configFileName: '',
                projectHandle,
              }),
            ),
          ),
        ).toEqual([{}, {}]);
        const params = {
          content: 'export const value = 1 |> % + 1;',
          fileName: '/workspace/file.fts',
          projectHandle: 'one',
        };
        const result = await connection.sendRequest<TransformResult>(
          'transform',
          params,
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.text).not.toContain('|>');
        expect(result.extension).toBe('.ts');
        expect(
          await connection.sendRequest('closeProject', {
            projectHandle: 'one',
          }),
        ).toBeNull();
        await expect(
          connection.sendRequest('transform', params),
        ).rejects.toThrow('Unknown FTS project');
        expect(
          (
            await connection.sendRequest<TransformResult>('transform', {
              ...params,
              projectHandle: 'two',
            })
          ).diagnostics,
        ).toEqual([]);
      });
    });
  });
});
