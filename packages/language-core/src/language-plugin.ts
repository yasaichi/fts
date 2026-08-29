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

export function createFutureTypeScriptLanguagePlugin(
  typescript: typeof ts,
): LanguagePlugin<URI, FutureTypeScriptVirtualCode> {
  return {
    createVirtualCode(uri, languageId, snapshot) {
      if (!isFutureTypeScript(uri, languageId)) {
        return undefined;
      }
      return new FutureTypeScriptVirtualCode(typescript, uri, snapshot);
    },
    getLanguageId(uri) {
      if (uri.path.endsWith('.fts')) {
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
    updateVirtualCode(uri, virtualCode, snapshot) {
      virtualCode.update(uri, snapshot);
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
    uri: URI,
    sourceSnapshot: IScriptSnapshot,
  ) {
    this.snapshot = sourceSnapshot;
    this.update(uri, sourceSnapshot);
  }

  public update(uri: URI, sourceSnapshot: IScriptSnapshot): void {
    const source = sourceSnapshot.getText(0, sourceSnapshot.getLength());
    const lowered = createVirtualTypeScript(source, uri.fsPath || uri.path);
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

function isFutureTypeScript(uri: URI, languageId: string): boolean {
  return languageId === futureTypeScriptLanguageId || uri.path.endsWith('.fts');
}
