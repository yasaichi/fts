import type {
  IScriptSnapshot,
  LanguagePlugin,
  VirtualCode,
} from '@volar/language-core';
import type { TypeScriptServiceScript } from '@volar/typescript';
import type * as ts from 'typescript';
import type { URI } from 'vscode-uri';
import { createPipelineVirtualTypeScript } from './features/pipeline-operator/editor-lowering.js';
import { createIdentityLowering, type LoweredTypeScript } from './lowering.js';

export const futureTypeScriptLanguageId = 'future-typescript';

export function createFutureTypeScriptCompilerPlugin(
  typescript: typeof ts,
): LanguagePlugin<string, FutureTypeScriptVirtualCode> {
  return createFutureTypeScriptPlugin(typescript, (fileName) => fileName);
}

export function createFutureTypeScriptLanguagePlugin(
  typescript: typeof ts,
): LanguagePlugin<URI, FutureTypeScriptVirtualCode> {
  return createFutureTypeScriptPlugin(
    typescript,
    (uri) => uri.fsPath || uri.path,
  );
}

function createFutureTypeScriptPlugin<ID>(
  typescript: typeof ts,
  fileNameOf: (id: ID) => string,
): LanguagePlugin<ID, FutureTypeScriptVirtualCode> {
  return {
    createVirtualCode(id, languageId, snapshot) {
      const fileName = fileNameOf(id);
      if (!isFutureTypeScript(fileName, languageId)) {
        return undefined;
      }
      return new FutureTypeScriptVirtualCode(typescript, fileName, snapshot);
    },
    getLanguageId(id) {
      if (fileNameOf(id).endsWith('.fts')) {
        return futureTypeScriptLanguageId;
      }
      return undefined;
    },
    typescript: {
      extraFileExtensions: [
        {
          extension: 'fts',
          isMixedContent: true,
          scriptKind: typescript.ScriptKind.TS,
        },
      ],
      getServiceScript(root): TypeScriptServiceScript {
        return {
          code: root,
          extension: '.ts',
          preventLeadingOffset: true,
          scriptKind: typescript.ScriptKind.TS,
        };
      },
    },
    updateVirtualCode(id, virtualCode, snapshot) {
      virtualCode.update(fileNameOf(id), snapshot);
      return virtualCode;
    },
  };
}

export class FutureTypeScriptVirtualCode implements VirtualCode {
  public readonly embeddedCodes: VirtualCode[] = [];
  public readonly id = 'typescript';
  public readonly languageId = 'typescript';
  public mappings: VirtualCode['mappings'] = [];
  public snapshot: IScriptSnapshot;

  public constructor(
    private readonly typescript: typeof ts,
    fileName: string,
    sourceSnapshot: IScriptSnapshot,
  ) {
    this.snapshot = sourceSnapshot;
    this.update(fileName, sourceSnapshot);
  }

  public update(fileName: string, sourceSnapshot: IScriptSnapshot): void {
    const source = sourceSnapshot.getText(0, sourceSnapshot.getLength());
    const lowered = createVirtualTypeScript(source, fileName);
    this.mappings = lowered.mappings;
    this.snapshot = this.typescript.ScriptSnapshot.fromString(lowered.code);
  }
}

function createVirtualTypeScript(
  source: string,
  fileName: string,
): LoweredTypeScript {
  try {
    return createPipelineVirtualTypeScript(source, fileName);
  } catch {
    return createIdentityLowering(source);
  }
}

function isFutureTypeScript(fileName: string, languageId: string): boolean {
  return languageId === futureTypeScriptLanguageId || fileName.endsWith('.fts');
}
