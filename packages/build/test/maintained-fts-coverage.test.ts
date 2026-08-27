import { spawnSync } from 'node:child_process';
import { glob } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe as context, describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const buildPackageRoot = fileURLToPath(new URL('../', import.meta.url));
const collectFiles = async (
  exclude: string[],
  patterns: string | readonly string[],
) => {
  const files: string[] = [];
  for await (const file of glob(patterns, { cwd: repositoryRoot, exclude })) {
    files.push(file);
  }
  return files.toSorted();
};
const maintainedFiles = await collectFiles(
  ['packages/*/test/fixtures/**/*.fts'],
  ['packages/*/src/**/*.fts', 'packages/*/test/**/*.fts'],
);
const hiddenTestFiles = await collectFiles(
  [],
  'packages/*/test/fixtures/**/*.test.fts',
);

describe('maintained FTS coverage', () => {
  it('contains repository-maintained FTS source', () => {
    expect(maintainedFiles).not.toEqual([]);
  });

  it('does not classify FTS tests as fixtures', () => {
    expect(hiddenTestFiles).toEqual([]);
  });

  describe('Prettier', () => {
    it('uses babel-ts for every maintained source', () => {
      expect(
        maintainedFiles.map((file) => {
          const result = spawnSync(
            process.execPath,
            ['node_modules/prettier/bin/prettier.cjs', '--file-info', file],
            { cwd: repositoryRoot, encoding: 'utf8' },
          );

          return {
            file,
            info: JSON.parse(result.stdout),
            status: result.status,
          };
        }),
      ).toEqual(
        maintainedFiles.map((file) => ({
          file,
          info: { ignored: false, inferredParser: 'babel-ts' },
          status: 0,
        })),
      );
    });
  });

  describe('semantic check', () => {
    it('reads every maintained source', () => {
      const result = spawnSync(
        process.execPath,
        [
          'packages/language-core/dist/check-fts.mjs',
          '-p',
          'tsconfig.fts.json',
          '--listFilesOnly',
        ],
        { cwd: repositoryRoot, encoding: 'utf8' },
      );
      const checkedFtsFiles = result.stdout
        .split('\n')
        .filter((file) => file.endsWith('.fts'))
        .map((file) => relative(repositoryRoot, file))
        .toSorted();

      expect({ files: checkedFtsFiles, status: result.status }).toEqual({
        files: maintainedFiles,
        status: 0,
      });
    });
  });

  describe('Vitest', () => {
    context('with the build package config', () => {
      it('discovers every maintained source', () => {
        const result = spawnSync(
          process.execPath,
          [
            resolve(repositoryRoot, 'node_modules/vitest/vitest.mjs'),
            'list',
            '--config',
            'vite.config.ts',
            '--filesOnly',
          ],
          { cwd: buildPackageRoot, encoding: 'utf8' },
        );
        const discoveredFtsFiles = result.stdout
          .split('\n')
          .filter((file) => file.endsWith('.fts'))
          .map((file) => `packages/build/${file}`)
          .toSorted();

        expect({ files: discoveredFtsFiles, status: result.status }).toEqual({
          files: maintainedFiles,
          status: 0,
        });
      });
    });
  });
});
