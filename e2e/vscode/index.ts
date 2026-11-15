import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { run as runTests } from 'node:test';
import { inspect } from 'node:util';
import { version } from 'vscode';

export async function run(): Promise<void> {
  const directory = process.env.FTS_VSIX_ACCEPTANCE_DIRECTORY;
  assert(
    directory,
    'The acceptance launcher must provide its isolated directory',
  );
  const mode = process.env.FTS_VSIX_ACCEPTANCE_MODE;
  const observations: { name: string; error?: string }[] = [];
  const suitePath = join(__dirname, 'installed-vsix.test.cjs');
  const tests = runTests({
    files: [suitePath],
    isolation: 'none',
    timeout: 60000,
  });
  let failures = 0;
  let completed = false;
  for await (const event of tests) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    if (event.type === 'test:fail') {
      if (event.data.details.type === 'test') failures++;
      observations.push({
        name: event.data.name,
        error: inspect(event.data.details.error),
      });
    } else if (event.data.details.type === 'test')
      observations.push({ name: event.data.name });
    // Extension Host stays alive, so the stream's process-exit summary cannot
    // complete while VS Code awaits this function. The outer suite's result
    // arrives after all its tests and hooks have finished.
    if (event.data.nesting === 0) {
      if (event.type === 'test:fail' && failures === 0) failures = 1;
      completed = true;
      break;
    }
  }
  const suite: typeof import('./installed-vsix.test.ts') = require(suitePath);
  writeFileSync(
    join(directory, `${mode}.json`),
    JSON.stringify(
      {
        vscode: version,
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        sdk: suite.sdk?.version,
        sdkPath: suite.sdk?.packageJsonPath,
        failures,
        observations,
      },
      null,
      2,
    ),
  );
  assert(
    completed && observations.length > 0,
    'No installed VSIX tests completed',
  );
  if (failures)
    throw new Error(`${failures} installed VSIX acceptance test(s) failed`);
}
