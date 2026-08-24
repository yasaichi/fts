const { spawnSync } = require('node:child_process');
const path = require('node:path');

process.stdin.resume();
process.stdin.on('end', () => {
  const checks = [
    ['Biome format', ['run', 'format']],
    ['Oxlint safe fix', ['run', 'lint:fix']],
  ];

  for (const [name, npmArguments] of checks) {
    const result = spawnSync('npm', npmArguments, {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf8',
    });

    if (result.status === 0) {
      continue;
    }

    const diagnostics = [result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim()
      .split('\n')
      .slice(-40)
      .join('\n');

    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `${name} reported diagnostics that require another edit.`,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: [
            `${name} failed after the edit.`,
            diagnostics,
            'FIX: Correct the remaining diagnostics, then rerun npm run format and npm run lint.',
          ].join('\n\n'),
        },
      }),
    );
    break;
  }
});
