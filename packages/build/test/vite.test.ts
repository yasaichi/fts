import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { build, type Rollup } from 'vite';
import { beforeAll, describe as context, describe, expect, it } from 'vitest';

const fixtureRoot = fileURLToPath(
  new URL('./fixtures/vite-project/', import.meta.url),
);
const buildFixture = async (input: string) => {
  const result = await build({
    build: {
      minify: false,
      rollupOptions: {
        input: resolve(fixtureRoot, input),
        preserveEntrySignatures: 'strict',
      },
      sourcemap: true,
      write: false,
    },
    configFile: resolve(fixtureRoot, 'vite.config.ts'),
    logLevel: 'silent',
    root: fixtureRoot,
  });

  if (!('output' in result)) {
    throw new Error('Expected Vite to return one build output');
  }

  return result.output.flatMap((artifact) =>
    artifact.type === 'chunk' ? [artifact] : [],
  );
};

describe('fts()', () => {
  describe('Vite build', () => {
    context('with a valid .fts module', () => {
      let chunks: Rollup.OutputChunk[];

      beforeAll(async () => {
        chunks = await buildFixture('src/index.ts');
      });

      describe('code', () => {
        it('contains neither proposal nor TypeScript syntax', () => {
          expect(chunks).toHaveLength(1);
          const [chunk] = chunks;

          expect(chunk.code).not.toContain('|>');
          expect(chunk.code).not.toContain(': number');
        });

        it('exports the pipeline result at runtime', async () => {
          expect(chunks).toHaveLength(1);
          const [chunk] = chunks;

          expect(
            await import(
              `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`
            ),
          ).toMatchObject({ answer: 42 });
        });
      });

      describe('map', () => {
        // oxlint-disable-next-line unicorn/consistent-function-scoping -- Keep this helper within the map contract.
        const positionOfSymbol = (text: string, symbol: string) => {
          const offset = text.indexOf(symbol);

          if (offset < 0) {
            throw new Error(`Could not find "${symbol}" in source`);
          }

          const prefix = text.slice(0, offset);
          return {
            column: offset - (prefix.lastIndexOf('\n') + 1),
            line: prefix.split('\n').length,
          };
        };

        it('traces the generated export to the original .fts symbol', () => {
          expect(chunks).toHaveLength(1);
          const [chunk] = chunks;
          expect(chunk.map).not.toBeNull();

          const original = originalPositionFor(
            new TraceMap(JSON.stringify(chunk.map)),
            positionOfSymbol(chunk.code, 'answer'),
          );

          expect(original).toMatchObject({
            column: 13,
            line: 3,
            source: expect.stringMatching(/pipeline\.fts$/),
          });
        });
      });
    });

    context('with an invalid .fts module', () => {
      it('fails with the original filename', async () => {
        await expect(buildFixture('src/invalid-entry.ts')).rejects.toThrow(
          /invalid\.fts/,
        );
      });
    });
  });

  describe('Vitest', () => {
    context('with the fixture Vite config', () => {
      const vitest = spawnSync(
        process.execPath,
        [
          fileURLToPath(
            new URL('../../../node_modules/vitest/vitest.mjs', import.meta.url),
          ),
          'run',
          '--config',
          'vite.config.ts',
        ],
        { cwd: fixtureRoot, encoding: 'utf8' },
      );

      it('executes the imported .fts module', () => {
        expect({
          status: vitest.status,
          stderr: vitest.stderr,
          stdout: vitest.stdout,
        }).toMatchObject({ status: 0 });
      });
    });
  });
});
