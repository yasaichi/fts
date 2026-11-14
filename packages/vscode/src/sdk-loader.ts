import { createTypeScriptModuleLoader } from 'typescript/vscode';

const packageJsonPath = process.argv[2];
if (!packageJsonPath)
  throw new Error(
    'The FTS editor mapper requires the selected TypeScript SDK path.',
  );

export const loader = createTypeScriptModuleLoader(packageJsonPath);
