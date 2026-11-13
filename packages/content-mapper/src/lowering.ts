// TypeScript 7.1.0-beta content mapper protocol:
// https://github.com/microsoft/typescript-go/pull/4712
export type SpanMapping = [
  virtualStart: number,
  virtualLength: number,
  originalStart: number,
  originalLength: number,
  kind: 0 | 1 | 2,
  features?: number,
];

export interface MapperDiagnostic {
  code: number;
  length: number;
  messageText: string;
  start: number;
}

export interface LoweredTypeScript {
  code: string;
  diagnostics: MapperDiagnostic[];
  mappings: SpanMapping[];
}
