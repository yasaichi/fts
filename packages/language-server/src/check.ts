import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createTypeScriptChecker,
  createTypeScriptInferredChecker,
} from '@volar/kit';
import { globSync } from 'tinyglobby';
import * as typescript from 'typescript';
import { createFutureTypeScriptLanguageTools } from './language-tools.js';

type VolarChecker = ReturnType<typeof createTypeScriptChecker>;

export type FutureTypeScriptDiagnostic = Awaited<
  ReturnType<VolarChecker['check']>
>[number];

export type FutureTypeScriptCheckResult = {
  errorCount: number;
  files: {
    diagnostics: FutureTypeScriptDiagnostic[];
    fileName: string;
    text: string;
  }[];
};

export type FutureTypeScriptChecker = {
  check(): Promise<FutureTypeScriptCheckResult>;
};

export function createFutureTypeScriptChecker({
  root,
  tsconfig,
}: {
  root: string;
  tsconfig?: string;
}): FutureTypeScriptChecker {
  const workspaceRoot = resolve(root);
  const configPath = findConfigPath(workspaceRoot, tsconfig);
  const { languagePlugins, services } =
    createFutureTypeScriptLanguageTools(typescript);
  const checker = configPath
    ? createTypeScriptChecker(languagePlugins, services, configPath)
    : createTypeScriptInferredChecker(languagePlugins, services, () =>
        globSync('**/*.fts', {
          absolute: true,
          cwd: workspaceRoot,
          expandDirectories: false,
          ignore: ['**/.git/**', '**/dist/**', '**/node_modules/**'],
        }),
      );

  return {
    async check() {
      const checkedFiles = await Promise.all(
        checker.getRootFileNames().map(async (fileName) => {
          const diagnostics = await checker.check(fileName);
          return {
            diagnostics,
            fileName,
            text: checker.printErrors(fileName, diagnostics, workspaceRoot),
          };
        }),
      );
      const files = checkedFiles.filter(
        ({ diagnostics }) => diagnostics.length > 0,
      );
      const errorCount = files.reduce(
        (count, { diagnostics }) =>
          count + diagnostics.filter(({ severity }) => severity === 1).length,
        0,
      );

      return { errorCount, files };
    },
  };
}

function findConfigPath(
  workspaceRoot: string,
  explicitConfigPath: string | undefined,
): string | undefined {
  if (explicitConfigPath) {
    const configPath = resolve(workspaceRoot, explicitConfigPath);
    if (!existsSync(configPath)) {
      throw new Error(`Specified config file does not exist: ${configPath}`);
    }
    return configPath;
  }

  return (
    typescript.findConfigFile(workspaceRoot, typescript.sys.fileExists) ??
    typescript.findConfigFile(
      workspaceRoot,
      typescript.sys.fileExists,
      'jsconfig.json',
    )
  );
}
