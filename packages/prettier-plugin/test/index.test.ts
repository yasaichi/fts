import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pluginPath = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const prettierPath = fileURLToPath(
  new URL('../../../node_modules/prettier/bin/prettier.cjs', import.meta.url),
);

const runPrettier = (argument: '--check' | '--write', filePath: string) =>
  spawnSync(
    process.execPath,
    [prettierPath, '--plugin', pluginPath, argument, filePath],
    { encoding: 'utf8' },
  );

describe('FTS Prettier plugin', () => {
  it('formats .fts files through the Prettier CLI', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fts-prettier-plugin-'));
    const filePath = join(directory, 'example.fts');

    try {
      writeFileSync(filePath, 'const result={ id:1}|>format(%)\n');

      expect(runPrettier('--check', filePath).status).toBe(1);
      expect(runPrettier('--write', filePath).status).toBe(0);
      expect(readFileSync(filePath, 'utf8')).toBe(
        'const result = { id: 1 } |> format(%);\n',
      );
      expect(runPrettier('--check', filePath).status).toBe(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
