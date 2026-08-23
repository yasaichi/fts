import type { CodeMapping } from '@volar/language-core';

export const codeInformation = {
  completion: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
} as const;

export interface LoweredTypeScript {
  code: string;
  mappings: CodeMapping[];
}

export function createIdentityLowering(source: string): LoweredTypeScript {
  return {
    code: source,
    mappings: [
      {
        data: codeInformation,
        generatedOffsets: [0],
        lengths: [source.length],
        sourceOffsets: [0],
      },
    ],
  };
}
