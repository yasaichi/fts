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

  const entry = result.output.find(
    (artifact) => artifact.type === 'chunk' && artifact.isEntry,
  );
  if (!entry || entry.type !== 'chunk') {
    throw new Error('Expected the fixture entry module');
  }
  return entry;
};

describe('fts()', () => {
  describe('Vite build', () => {
    context('when the entry imports a valid .fts module', () => {
      let chunk: Rollup.OutputChunk;

      beforeAll(async () => {
        chunk = await buildFixture('src/index.ts');
      });

      describe('code', () => {
        it('contains neither proposal nor TypeScript syntax', () => {
          expect(chunk.code).not.toContain('|>');
          expect(chunk.code).not.toContain(': number');
        });

        it('exports the pipeline result at runtime', async () => {
          expect(
            await import(
              `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`
            ),
          ).toMatchObject({ answer: 42 });
        });
      });

      describe('map', () => {
        it('traces the generated export to the original .fts symbol', () => {
          expect(chunk.map).not.toBeNull();
          const offset = chunk.code.indexOf('answer');
          expect(offset).toBeGreaterThanOrEqual(0);
          const prefix = chunk.code.slice(0, offset);
          const original = originalPositionFor(
            new TraceMap(JSON.stringify(chunk.map)),
            {
              column: offset - prefix.lastIndexOf('\n') - 1,
              line: prefix.split('\n').length,
            },
          );

          expect(original).toMatchObject({
            column: 13,
            line: 3,
            source: expect.stringMatching(/pipeline\.fts$/),
          });
        });
      });
    });

    context('when the entry imports an invalid .fts module', () => {
      it('fails with the original filename', async () => {
        await expect(buildFixture('src/invalid-entry.ts')).rejects.toThrow(
          /\[plugin fts\].*invalid\.fts/,
        );
      });
    });
  });

  describe('Vitest', () => {
    context('when the fixture Vite config is used', () => {
      it('executes the imported .fts module', () => {
        const vitest = spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL(
                '../../../node_modules/vitest/vitest.mjs',
                import.meta.url,
              ),
            ),
            'run',
            '--config',
            'vite.config.ts',
          ],
          { cwd: fixtureRoot, encoding: 'utf8' },
        );
        expect(vitest.status).toBe(0);
      });
    });
  });
});
