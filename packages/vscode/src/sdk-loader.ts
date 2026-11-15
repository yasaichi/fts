import { createTypeScriptModuleLoader } from 'typescript/vscode';

// extension.ts registers: [nodeExecutable, mapperEntryPoint, sdk.packageJsonPath].
// Node reserves argv[0] for its executable and argv[1] for the entry point.
const packageJsonPath = process.argv[2];
if (!packageJsonPath)
  throw new Error(
    'The FTS editor mapper requires the selected TypeScript SDK path.',
  );

export const loader = createTypeScriptModuleLoader(packageJsonPath);
