import { parseArgs, stripVTControlCharacters } from 'node:util';
import { createFutureTypeScriptChecker } from '@ftslang/server/check';

const help = `Usage: fts-check [options]

Options:
  --root <path>      Project root (default: current directory)
  --tsconfig <path>  tsconfig.json or jsconfig.json relative to root
  --help             Show this help
`;

export async function runFutureTypeScriptCheck(
  args: string[] = process.argv.slice(2),
): Promise<number> {
  try {
    const { values } = parseArgs({
      allowPositionals: false,
      args,
      options: {
        help: { type: 'boolean' },
        root: { type: 'string' },
        tsconfig: { type: 'string' },
      },
      strict: true,
    });

    if (values.help) {
      process.stdout.write(help);
      return 0;
    }

    const checker = createFutureTypeScriptChecker({
      root: values.root ?? process.cwd(),
      tsconfig: values.tsconfig,
    });
    const result = await checker.check();

    for (const { text } of result.files) {
      process.stdout.write(stripVTControlCharacters(text));
    }
    process.stdout.write(
      `Found ${result.errorCount} ${result.errorCount === 1 ? 'error' : 'errors'}.\n`,
    );

    return result.errorCount === 0 ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 2;
  }
}
