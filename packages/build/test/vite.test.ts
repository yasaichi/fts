import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { type BuildOptions, build, type InlineConfig, type Rollup } from 'vite';
import {
  assert,
  beforeAll,
  describe as context,
  describe,
  expect,
  it,
} from 'vitest';
import { futureTypeScriptIdFilter } from '../src/unplugin.js';

const fixtureRoot = fileURLToPath(
  new URL('./fixtures/vite-project/', import.meta.url),
);
const fixtureBuildOptions = {
  minify: false,
  sourcemap: true,
  write: false,
} satisfies BuildOptions;
const fixtureConfig = {
  configFile: resolve(fixtureRoot, 'vite.config.ts'),
  logLevel: 'silent',
  root: fixtureRoot,
} satisfies InlineConfig;

describe('futureTypeScript()', () => {
  describe('Vite build', () => {
    context('with a valid .fts module', () => {
      const source = readFileSync(
        resolve(fixtureRoot, 'src/pipeline.fts'),
        'utf8',
      );
      let chunk: Rollup.OutputChunk;

      beforeAll(async () => {
        const result = await build({
          ...fixtureConfig,
          build: {
            ...fixtureBuildOptions,
            rollupOptions: {
              input: resolve(fixtureRoot, 'src/index.ts'),
              preserveEntrySignatures: 'strict',
            },
          },
        });
        if (Array.isArray(result) || !('output' in result)) {
          assert.fail('Vite did not return a single build output');
        }
        const output = result.output.find(
          (artifact) => artifact.type === 'chunk',
        );
        assert.isDefined(output);
        chunk = output;
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
          const answerOffset = chunk.code.indexOf('answer');
          assert.isAtLeast(answerOffset, 0);
          assert.isNotNull(chunk.map);

          const generatedPrefix = chunk.code.slice(0, answerOffset);
          const original = originalPositionFor(
            new TraceMap(chunk.map.toString()),
            {
              column: answerOffset - (generatedPrefix.lastIndexOf('\n') + 1),
              line: (generatedPrefix.match(/\n/g)?.length ?? 0) + 1,
            },
          );
          assert.isNotNull(original.column);
          assert.isNotNull(original.line);
          assert.isNotNull(original.source);

          const originalLine = source.split('\n')[original.line - 1];
          assert.isDefined(originalLine);
          expect(original.source).toMatch(/pipeline\.fts(?:\?fixture)?$/);
          expect(originalLine.slice(original.column)).toMatch(/^answer\b/);
        });
      });
    });

    context('with an invalid .fts module', () => {
      it('fails with the original filename', async () => {
        await expect(
          build({
            ...fixtureConfig,
            build: {
              ...fixtureBuildOptions,
              rollupOptions: {
                input: resolve(fixtureRoot, 'src/invalid-entry.ts'),
                preserveEntrySignatures: 'strict',
              },
            },
          }),
        ).rejects.toThrow(/invalid\.fts/);
      });
    });
  });

  describe('Vitest', () => {
    context('with the fixture Vite config', () => {
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

        expect({
          status: vitest.status,
          stderr: vitest.stderr,
          stdout: vitest.stdout,
        }).toMatchObject({ status: 0 });
      });
    });
  });
});

describe('futureTypeScriptIdFilter', () => {
  describe('include', () => {
    context('with an ordinary .ts module', () => {
      it('does not include the module', () => {
        expect(
          futureTypeScriptIdFilter.include.test('/project/src/index.ts'),
        ).toBe(false);
      });
    });
  });

  describe('exclude', () => {
    context('with an .fts module in node_modules', () => {
      it('excludes the module', () => {
        expect(
          futureTypeScriptIdFilter.exclude.test(
            '/project/node_modules/dependency/index.fts',
          ),
        ).toBe(true);
      });
    });
  });
});
