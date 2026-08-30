import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFutureTypeScriptChecker } from '@ftslang/server/check';
import { afterEach, describe as context, describe, expect, it } from 'vitest';

const binPath = fileURLToPath(
  new URL('../../../node_modules/.bin/fts-check', import.meta.url),
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function fixturePath(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}/`, import.meta.url));
}

function inferredFixturePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'fts-check-'));
  temporaryDirectories.push(directory);
  copyFileSync(
    fileURLToPath(new URL('./fixtures/inferred/invalid.fts', import.meta.url)),
    join(directory, 'invalid.fts'),
  );
  return directory;
}

describe('createFutureTypeScriptChecker({ root, tsconfig })', () => {
  context('with a configured valid project', () => {
    it('returns no errors', async () => {
      const checker = createFutureTypeScriptChecker({
        root: fixturePath('valid'),
      });

      await expect(checker.check()).resolves.toEqual({
        errorCount: 0,
        files: [],
      });
    });
  });

  context('with a configured invalid fts file', () => {
    it('maps the diagnostic to the original topic token', async () => {
      const checker = createFutureTypeScriptChecker({
        root: fixturePath('invalid-fts'),
      });
      const result = await checker.check();
      const file = result.files.find(({ fileName }) =>
        fileName.endsWith('/invalid.fts'),
      );

      expect(result.errorCount).toBe(1);
      expect(file).toMatchObject({
        diagnostics: [
          expect.objectContaining({
            message: expect.stringContaining(
              "not assignable to parameter of type 'number'",
            ),
            range: {
              end: { character: 17, line: 5 },
              start: { character: 16, line: 5 },
            },
          }),
        ],
        text: expect.stringContaining('invalid.fts'),
      });
      expect(file?.text).not.toContain('_ref');
    });
  });

  context('with a configured invalid TypeScript file', () => {
    it('returns its type error', async () => {
      const checker = createFutureTypeScriptChecker({
        root: fixturePath('invalid-ts'),
      });
      const result = await checker.check();

      expect(result.errorCount).toBe(1);
      expect(result.files[0]).toMatchObject({
        fileName: expect.stringMatching(/invalid\.ts$/),
        diagnostics: [
          expect.objectContaining({
            message: expect.stringContaining(
              "Type 'string' is not assignable to type 'number'",
            ),
          }),
        ],
      });
    });
  });

  context('with an explicit config', () => {
    it('checks the selected project', async () => {
      const checker = createFutureTypeScriptChecker({
        root: fixturePath('explicit-config'),
        tsconfig: 'selected.json',
      });

      await expect(checker.check()).resolves.toEqual({
        errorCount: 0,
        files: [],
      });
    });
  });

  context('without a config', () => {
    it('checks fts files as an inferred project', async () => {
      const checker = createFutureTypeScriptChecker({
        root: inferredFixturePath(),
      });
      const result = await checker.check();

      expect(result).toMatchObject({
        errorCount: 1,
        files: [
          {
            fileName: expect.stringMatching(/invalid\.fts$/),
          },
        ],
      });
    });
  });
});

describe('fts-check', () => {
  context('with a valid project outside the current directory', () => {
    it('exits successfully', () => {
      const result = spawnSync(binPath, ['--root', fixturePath('valid')], {
        encoding: 'utf8',
      });

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('Found 0 errors.');
    });
  });

  context('with an invalid fts project', () => {
    it('reports the original source and exits with a diagnostic failure', () => {
      const result = spawnSync(
        binPath,
        ['--root', fixturePath('invalid-fts')],
        { encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('invalid.fts:6:17');
      expect(result.stdout).toContain(
        "not assignable to parameter of type 'number'",
      );
      expect(result.stdout).not.toContain('_ref');
    });
  });

  context('with an invalid TypeScript project', () => {
    it('exits with a diagnostic failure', () => {
      const result = spawnSync(binPath, ['--root', fixturePath('invalid-ts')], {
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('invalid.ts');
    });
  });

  context('with an explicit config', () => {
    it('checks the selected project', () => {
      const result = spawnSync(
        binPath,
        [
          '--root',
          fixturePath('explicit-config'),
          '--tsconfig',
          'selected.json',
        ],
        { encoding: 'utf8' },
      );

      expect(result).toMatchObject({ status: 0, stderr: '' });
    });
  });

  it.each([
    ['an invalid option', ['--invalid']],
    [
      'a missing explicit config',
      ['--root', fixturePath('valid'), '--tsconfig', 'missing.json'],
    ],
  ])('exits with an execution error for %s', (_condition, args) => {
    const result = spawnSync(binPath, args, { encoding: 'utf8' });

    expect(result.status).toBe(2);
    expect(result.stderr).not.toBe('');
  });

  context('with --help', () => {
    it('prints usage without starting the checker', () => {
      const result = spawnSync(binPath, ['--help'], {
        cwd: inferredFixturePath(),
        encoding: 'utf8',
      });

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toContain('Usage: fts-check');
      expect(result.stdout).not.toContain('Found');
    });
  });
});
