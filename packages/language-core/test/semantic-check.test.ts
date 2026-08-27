import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe as context, describe, expect, it } from 'vitest';

const checkerPath = fileURLToPath(
  new URL('../dist/check-fts.mjs', import.meta.url),
);
const rootConfigPath = fileURLToPath(
  new URL('../../../tsconfig.fts.json', import.meta.url),
);
const dogfoodPath = fileURLToPath(
  new URL('../../build/test/unplugin.test.fts', import.meta.url),
);
const invalidFixturePath = fileURLToPath(
  new URL('./fixtures/semantic-check/invalid.fts', import.meta.url),
);
const runSemanticCheck = (arguments_: string[]) =>
  spawnSync(process.execPath, [checkerPath, ...arguments_], {
    encoding: 'utf8',
  });

describe('FTS semantic check', () => {
  context('with the maintained FTS configuration', () => {
    it('accepts the maintained dogfood source', () => {
      const result = runSemanticCheck(['-p', rootConfigPath]);

      expect({ status: result.status, stderr: result.stderr }).toMatchObject({
        status: 0,
      });
    });

    it('reads the maintained dogfood source', () => {
      const result = runSemanticCheck([
        '-p',
        rootConfigPath,
        '--listFilesOnly',
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(dogfoodPath);
    });
  });

  context('with a type-invalid FTS fixture', () => {
    it('reports the semantic error against the original source', () => {
      const result = runSemanticCheck([
        '--module',
        'NodeNext',
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--target',
        'ES2024',
        invalidFixturePath,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain(basename(invalidFixturePath));
      expect(result.stdout).toContain(
        "Type 'string' is not assignable to type 'number'",
      );
    });
  });
});
