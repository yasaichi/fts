import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assert,
  beforeAll,
  describe as context,
  describe,
  expect,
  it,
} from 'vitest';
import { tsc } from './connection.js';
import baseline from './fixtures/parity/volar-baseline.json' with {
  type: 'json',
};

const fixtures = fileURLToPath(new URL('./fixtures/parity/', import.meta.url));

function check(files: string[]) {
  const directory = mkdtempSync(join(tmpdir(), 'fts-tsc-'));
  try {
    symlinkSync(
      fileURLToPath(new URL('../../../node_modules/', import.meta.url)),
      join(directory, 'node_modules'),
      'junction',
    );
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: join(fixtures, 'tsconfig.json'),
        files: files.map((file) => join(fixtures, file)),
        include: [],
      }),
    );
    return spawnSync(
      process.execPath,
      [
        tsc,
        '-p',
        join(directory, 'tsconfig.json'),
        '--pretty',
        'false',
        '--runExternalCode',
      ],
      { encoding: 'utf8', timeout: 20000 },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('tsc --runExternalCode', () => {
  context.each(baseline.files)(
    'when $condition',
    ({ file, diagnostics, exitStatus }) => {
      let result: ReturnType<typeof check>;

      beforeAll(() => {
        result = check([file]);
      });

      describe('exit status', () => {
        it('reports whether checking the FTS source succeeded', () => {
          expect(result.error).toBeUndefined();
          expect(result.stderr).toBe('');
          expect(result.status).toBe(exitStatus === 0 ? 0 : 2);
        });
      });

      describe('diagnostics', () => {
        it('matches the pre-migration filenames, positions and codes', () => {
          const actual = Array.from(
            result.stdout.matchAll(
              /([^\s]+\.fts)\((\d+),(\d+)\): error (?:TS|fts)(\d+):/g,
            ),
            ([, name, line, character, code]) => {
              assert.isDefined(name);
              return {
                file: name.split('/').at(-1),
                code: Number(code),
                line: Number(line) - 1,
                character: Number(character) - 1,
              };
            },
          );
          expect(actual).toEqual(
            expect.arrayContaining(
              diagnostics.map(({ code, range }) => ({
                file,
                code,
                ...range.start,
              })),
            ),
          );
          expect(actual).toHaveLength(diagnostics.length);
        });
      });
    },
  );

  context('when source contains an unrecoverable syntax error', () => {
    let result: ReturnType<typeof check>;

    beforeAll(() => {
      result = check(['../pipeline-operator/incomplete.fts']);
    });

    describe('exit status', () => {
      it('fails the check', () => {
        expect(result.status).toBeGreaterThan(0);
      });
    });

    describe('diagnostics', () => {
      it('reports the frontend syntax error', () => {
        expect(result.stdout).toContain('fts1000');
      });
    });
  });
});

describe('package-lock.json', () => {
  describe('dependencies', () => {
    it('contains no legacy language tooling dependencies', () => {
      const lockfile = readFileSync(
        new URL('../../../package-lock.json', import.meta.url),
        'utf8',
      );
      expect(lockfile).not.toMatch(
        /@volar\/|volar-service-|vscode-languageclient/,
      );
    });
  });
});
