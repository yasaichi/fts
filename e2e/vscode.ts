import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { delimiter, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from '@vscode/test-electron';
import mapperPackage from '../packages/content-mapper/package.json' with {
  type: 'json',
};

const repository = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
// macOS's IPC socket path limit requires a short user-data directory.
const directory = realpathSync(mkdtempSync('/tmp/fts-vsix-'));
const extensions = join(directory, 'extensions');
const consumer = join(directory, 'consumer');
const npm = process.env.npm_execpath;
assert(npm, 'Run acceptance through npm run test:e2e:vscode');
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !/^npm_/i.test(key) &&
      !/^VSCODE_/i.test(key) &&
      ![
        'ELECTRON_RUN_AS_NODE',
        'INIT_CWD',
        'NODE_OPTIONS',
        'NODE_PATH',
      ].includes(key),
  ),
);
env.PATH = env.PATH?.split(delimiter)
  .filter(
    (entry) => entry !== repository && !entry.startsWith(repository + sep),
  )
  .join(delimiter);
env.NPM_CONFIG_CACHE = join(directory, 'npm-cache');
env.NPM_CONFIG_GLOBALCONFIG = join(directory, 'global.npmrc');
env.NPM_CONFIG_USERCONFIG = join(directory, 'user.npmrc');
writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, '');
writeFileSync(
  env.NPM_CONFIG_USERCONFIG,
  'ignore-scripts=true\nmin-release-age=7\nregistry=https://registry.npmjs.org/\n',
);

function run(
  executable: string,
  args: string[],
  cwd = directory,
  extraEnv: NodeJS.ProcessEnv = {},
) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: { ...env, ...extraEnv, PWD: cwd },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180000,
  });
  appendFileSync(
    join(directory, 'commands.log'),
    `${cwd}\n> ${executable} ${args.join(' ')}\n${result.stdout}\n${result.stderr}\nstatus: ${result.status}; ${result.error?.message ?? ''}\n`,
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

let passed = false;
try {
  const packed = JSON.parse(
    run(
      process.execPath,
      [
        npm,
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        directory,
      ],
      join(repository, 'packages/content-mapper'),
    ),
  );
  const tarball = packed[0]?.filename;
  assert.equal(
    typeof tarball,
    'string',
    'npm pack must produce a mapper tarball',
  );
  mkdirSync(join(consumer, 'src'), { recursive: true });
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        devDependencies: {
          '@ftslang/content-mapper': `file:${join(directory, tarball)}`,
          typescript: mapperPackage.dependencies.typescript,
        },
      },
      null,
      2,
    ),
  );
  run(
    process.execPath,
    [npm, '--workspaces=false', 'install', '--no-audit', '--no-fund'],
    consumer,
  );
  // Use the same standalone project settings as npm acceptance, without a
  // repository base config or any repository node_modules resolution.
  const config = JSON.parse(
    readFileSync(
      join(repository, 'e2e/fixtures/vite-project/tsconfig.json'),
      'utf8',
    ),
  );
  config.compilerOptions.types = [];
  config.include = ['src'];
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify(config, null, 2),
  );
  writeFileSync(
    join(consumer, 'src/pipeline.fts'),
    'export const result = 1 |> % + 1;\nexport const broken: number = "wrong";\n',
  );
  writeFileSync(
    join(consumer, 'src/index.ts'),
    'import { result } from "./pipeline.fts";\nexport const text: string = result;\n',
  );
  mkdirSync(join(directory, 'inferred'));
  writeFileSync(
    join(directory, 'inferred/pipeline.fts'),
    'export const result = 1 |> % + 1;\nexport const copy = result;\nexport const broken: number = "wrong";\n',
  );

  const sdkB = join(directory, 'SDK with spaces/node_modules');
  mkdirSync(sdkB, { recursive: true });
  cpSync(join(consumer, 'node_modules/typescript'), join(sdkB, 'typescript'), {
    recursive: true,
  });
  cpSync(
    join(consumer, 'node_modules/@typescript'),
    join(sdkB, '@typescript'),
    { recursive: true },
  );
  const vsix = join(directory, 'ftslang.vsix');
  cpSync(join(repository, 'packages/vscode/dist/ftslang.vsix'), vsix);
  const executable = await downloadAndUnzipVSCode({
    cachePath: join(repository, '.vscode-test'),
    version: '1.145.2',
  });
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executable, {
    reuseMachineInstall: true,
  });
  assert(cli);
  const installArgs = [
    ...cliArgs,
    `--extensions-dir=${extensions}`,
    `--user-data-dir=${join(directory, 'install-profile')}`,
  ];
  run(cli, [
    ...installArgs,
    '--install-extension',
    'TypeScriptTeam.native-preview@1.0.2',
  ]);
  run(cli, [...installArgs, '--install-extension', vsix]);

  for (const mode of ['supported', 'default']) {
    const userData = join(directory, `profile-${mode}`);
    mkdirSync(join(userData, 'User'), { recursive: true });
    const settings: Record<string, unknown> = {
      'js/ts.experimental.useTsgo': true,
      'js/ts.contentMappers.enabled': true,
      'extensions.autoUpdate': false,
      'extensions.autoCheckUpdates': false,
      'update.mode': 'none',
      'telemetry.telemetryLevel': 'off',
      'workbench.startupEditor': 'none',
      'window.restoreWindows': 'none',
    };
    if (mode === 'supported')
      settings['js/ts.tsdk.path'] = join(consumer, 'node_modules/typescript');
    writeFileSync(
      join(userData, 'User/settings.json'),
      JSON.stringify(settings, null, 2),
    );
    // test-electron's runTests disables Workspace Trust. Launch the documented
    // extensionTestsPath entry directly so our acceptance keeps normal trust.
    run(
      executable,
      [
        `--user-data-dir=${userData}`,
        `--extensions-dir=${extensions}`,
        `--extensionDevelopmentPath=${join(repository, 'e2e/driver')}`,
        `--extensionTestsPath=${join(repository, 'e2e/dist/vscode.test.cjs')}`,
        '--skip-welcome',
        '--skip-release-notes',
        '--new-window',
      ],
      directory,
      {
        FTS_VSIX_ACCEPTANCE_DIRECTORY: directory,
        FTS_VSIX_ACCEPTANCE_MODE: mode,
      },
    );
    console.log(readFileSync(join(directory, `${mode}.json`), 'utf8'));
  }
  passed = true;
} finally {
  if (passed && !process.env.FTS_VSIX_KEEP)
    rmSync(directory, { recursive: true, force: true });
  else console.log(`VSIX acceptance evidence retained at ${directory}`);
}
