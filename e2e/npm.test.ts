import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe as context,
  describe,
  expect,
  it,
  onTestFailed,
} from 'vitest';

const repository = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const fixture = fileURLToPath(
  new URL('./fixtures/vite-project/', import.meta.url),
);
const source = readFileSync(join(fixture, 'src/pipeline.fts'), 'utf8');
const npm = process.env.npm_execpath;

let directory: string;

function expectSuccess(result: ReturnType<typeof run>) {
  expect(result.error).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}

function run(cwd: string, npmArgs: string[]) {
  if (!npm) throw new Error('Run e2e tests with npm run test:e2e');
  // npm scripts inherit repository bin paths and loader/configuration settings.
  // Keep the consumer's tool resolution independent of the invoking workspace.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/^npm_/i.test(key) &&
        !['INIT_CWD', 'NODE_OPTIONS', 'NODE_PATH'].includes(key),
    ),
  );
  const result = spawnSync(
    process.execPath,
    [npm, '--workspaces=false', ...npmArgs],
    {
      cwd,
      encoding: 'utf8',
      env: {
        ...env,
        CI: 'true',
        NPM_CONFIG_CACHE: join(directory, 'npm-cache'),
        NPM_CONFIG_GLOBALCONFIG: join(directory, 'global.npmrc'),
        NPM_CONFIG_USERCONFIG: join(directory, 'user.npmrc'),
        PATH: env.PATH?.split(delimiter)
          .filter(
            (entry) =>
              entry !== repository && !entry.startsWith(repository + sep),
          )
          .join(delimiter),
        PWD: cwd,
      },
      timeout: 120000,
    },
  );
  appendFileSync(
    join(directory, 'commands.log'),
    `${cwd}\n> npm ${npmArgs.join(' ')}\n${result.stdout}\n${result.stderr}\nstatus: ${result.status}; ${result.error?.message ?? ''}\n`,
  );
  return result;
}

describe('packed FTS packages', () => {
  let consumer: string;
  let failed = true;
  const tarballs: Record<string, string> = {};

  beforeAll(() => {
    directory = realpathSync(mkdtempSync(join(tmpdir(), 'fts-consumer-')));
    writeFileSync(join(directory, 'global.npmrc'), '');
    writeFileSync(
      join(directory, 'user.npmrc'),
      'ignore-scripts=false\nregistry=https://registry.npmjs.org/\n',
    );

    for (const name of ['build', 'content-mapper', 'prettier-plugin']) {
      const packed = run(join(repository, 'packages', name), [
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        directory,
      ]);
      expectSuccess(packed);
      const [artifact] = JSON.parse(packed.stdout) as { filename: string }[];
      if (!artifact)
        throw new Error(`npm pack produced no artifact for ${name}`);
      tarballs[`@ftslang/${name}`] =
        `file:${join(directory, artifact.filename)}`;
      writeFileSync(join(directory, `${name}.pack.json`), packed.stdout);
    }

    consumer = join(directory, 'application');
    cpSync(fixture, consumer, { recursive: true });
    const manifest = JSON.parse(
      readFileSync(join(consumer, 'package.json'), 'utf8'),
    );
    Object.assign(manifest.devDependencies, tarballs);
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify(manifest, null, 2),
    );
    expectSuccess(run(consumer, ['install', '--no-audit', '--no-fund']));
    failed = false;
  });

  beforeEach(() => {
    onTestFailed(() => {
      failed = true;
    });
    writeFileSync(join(consumer, 'src/pipeline.fts'), source);
  });

  afterAll(() => {
    if (failed) {
      console.error(`Consumer acceptance evidence retained at ${directory}`);
    } else {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  describe('TypeScript CLI', () => {
    context('when a TypeScript entry imports a well-typed FTS module', () => {
      it('checks the module using only the installed consumer tools', () => {
        expectSuccess(run(consumer, ['run', '--silent', 'check']));
        const inspected = run(consumer, ['run', '--silent', 'inspect']);
        expectSuccess(inspected);
        for (const path of Object.values(
          JSON.parse(inspected.stdout) as Record<string, string>,
        )) {
          const resolved = relative(consumer, realpathSync(path));
          expect(isAbsolute(resolved)).toBe(false);
          expect(resolved).not.toMatch(/^\.\.(?:[/\\]|$)/);
        }
      });
    });

    context('when the FTS module contains a type error', () => {
      beforeEach(() => {
        writeFileSync(
          join(consumer, 'src/pipeline.fts'),
          source.replace('answer: number', 'answer: string'),
        );
      });

      it('fails with the diagnostic at the original FTS declaration', () => {
        const result = run(consumer, ['run', '--silent', 'check']);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(2);
        expect(result.stdout).toMatch(/pipeline\.fts\(3,14\): error TS2322:/);
      });
    });
  });

  describe('Vite build', () => {
    context('when a TypeScript entry imports a valid FTS module', () => {
      it('produces an executable artifact mapped to the original FTS source', () => {
        expectSuccess(run(consumer, ['run', '--silent', 'build']));
        const executed = run(consumer, ['run', '--silent', 'start']);
        expectSuccess(executed);
        expect(executed.stdout.trim()).toBe('42');

        const code = readFileSync(join(consumer, 'dist/index.js'), 'utf8');
        const offset = code.indexOf('answer');
        expect(offset).toBeGreaterThanOrEqual(0);
        const prefix = code.slice(0, offset);
        expect(
          originalPositionFor(
            new TraceMap(
              readFileSync(join(consumer, 'dist/index.js.map'), 'utf8'),
            ),
            {
              column: offset - prefix.lastIndexOf('\n') - 1,
              line: prefix.split('\n').length,
            },
          ),
        ).toMatchObject({
          column: 13,
          line: 3,
          source: expect.stringMatching(/pipeline\.fts$/),
        });
      });
    });

    context('when the FTS module contains a syntax error', () => {
      beforeEach(() => {
        writeFileSync(
          join(consumer, 'src/pipeline.fts'),
          source.replace('double(%)', 'double('),
        );
      });

      it('fails the build with the original FTS filename', () => {
        const result = run(consumer, ['run', '--silent', 'build']);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/\[plugin fts\].*pipeline\.fts/);
      });
    });

    context('when the build package is the only direct FTS dependency', () => {
      it('installs its mapper dependency and builds the application', () => {
        const minimal = join(directory, 'build-only');
        cpSync(fixture, minimal, { recursive: true });
        const manifest = JSON.parse(
          readFileSync(join(fixture, 'package.json'), 'utf8'),
        );
        manifest.scripts = {
          build: manifest.scripts.build,
          start: manifest.scripts.start,
        };
        manifest.devDependencies = {
          '@ftslang/build': tarballs['@ftslang/build'],
          vite: manifest.devDependencies.vite,
        };
        // Replace the unpublished mapper's acquisition source without supplying
        // a dependency edge that a broken build manifest could be missing.
        manifest.overrides = {
          '@ftslang/content-mapper': tarballs['@ftslang/content-mapper'],
        };
        writeFileSync(
          join(minimal, 'package.json'),
          JSON.stringify(manifest, null, 2),
        );
        expectSuccess(run(minimal, ['install', '--no-audit', '--no-fund']));
        const build = JSON.parse(
          readFileSync(
            join(minimal, 'node_modules/@ftslang/build/package.json'),
            'utf8',
          ),
        );
        const mapper = JSON.parse(
          readFileSync(
            join(minimal, 'node_modules/@ftslang/content-mapper/package.json'),
            'utf8',
          ),
        );
        expect(build.dependencies['@ftslang/content-mapper']).toBe(
          mapper.version,
        );
        expectSuccess(run(minimal, ['run', '--silent', 'build']));
        const executed = run(minimal, ['run', '--silent', 'start']);
        expectSuccess(executed);
        expect(executed.stdout.trim()).toBe('42');
      });
    });
  });

  describe('Vitest', () => {
    context('when tests use the consumer Vite configuration', () => {
      it('executes the imported FTS module', () => {
        const result = run(consumer, ['test', '--', '--reporter=verbose']);
        expectSuccess(result);
        expect(result.stdout).toContain('exports the pipeline result');
      });
    });
  });

  describe('Prettier CLI', () => {
    context('when an FTS file needs formatting', () => {
      beforeEach(() => {
        writeFileSync(
          join(consumer, 'src/pipeline.fts'),
          source.replace('answer: number = ', 'answer:number='),
        );
      });

      it('formats the file through the installed plugin package', () => {
        const result = run(consumer, ['run', '--silent', 'format']);
        expectSuccess(result);
        expect(result.stdout).toBe(source);
      });
    });
  });
});
