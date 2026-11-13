import { createFileSystemWithLib } from 'typescript/fs';
import { API, ModuleKind } from 'typescript/sync';
import { beforeAll, describe as context, describe, expect, it } from 'vitest';
import {
  type TransformResult,
  transformFutureTypeScript,
} from '../src/transform.js';

function consumerDiagnostics(producer: string, consumer: string) {
  // Observe FTS recovery output directly, without project discovery or LSP.
  using checker = new API();
  using snapshot = checker.createSnapshot({
    fileSystem: createFileSystemWithLib([
      ['/producer.ts', producer],
      ['/consumer.ts', consumer],
    ]),
    createPrograms: [
      {
        rootFiles: ['/consumer.ts'],
        compilerOptions: {
          module: ModuleKind.CommonJS,
          noEmit: true,
          strict: true,
        },
      },
    ],
  });
  const program = snapshot.operation.createdPrograms[0];
  return [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];
}

describe('transformFutureTypeScript(source, fileName)', () => {
  context('when source contains a valid pipeline', () => {
    const result = transformFutureTypeScript(
      'export const result = 1 |> % + 1;',
      'valid.fts',
    );

    describe('diagnostics', () => {
      it('returns no errors', () => {
        expect(result.diagnostics).toEqual([]);
      });
    });

    describe('text', () => {
      it('does not contain pipeline syntax', () => {
        expect(result.text).not.toContain('|>');
      });
    });

    describe('mappings', () => {
      it('maps the lowered code to its source', () => {
        expect(result.mappings.length).toBeGreaterThan(0);
      });
    });
  });

  context('when source has no statements', () => {
    describe('diagnostics', () => {
      it.each(['', '// empty module'])('returns no errors for %j', (source) => {
        expect(
          transformFutureTypeScript(source, 'empty.fts').diagnostics,
        ).toEqual([]);
      });
    });
  });

  context('when source has a recoverable proposal error', () => {
    const source = 'export const result = 1 |> Math.abs(1);';
    const result = transformFutureTypeScript(source, 'invalid.fts');

    describe('diagnostics', () => {
      it('reports the frontend error at the original expression', () => {
        expect(result.diagnostics).toEqual([
          expect.objectContaining({
            code: 1000,
            start: source.indexOf('Math'),
          }),
        ]);
      });
    });

    describe('mappings', () => {
      it('retains semantic mappings', () => {
        expect(result.mappings.length).toBeGreaterThan(0);
      });
    });

    describe('text', () => {
      it('retains the source export', () => {
        expect(
          consumerDiagnostics(
            result.text,
            'import { result } from "./producer"; const value: number = result;',
          ),
        ).toEqual([]);
      });
    });
  });

  context('when source ends inside an unfinished binding', () => {
    const source = 'export const { key: renamed } = input |> parse(';
    let result: TransformResult;

    beforeAll(() => {
      result = transformFutureTypeScript(source, 'incomplete.fts');
    });

    describe('diagnostics', () => {
      it('reports the syntax error at the end of the file', () => {
        expect(result.diagnostics).toEqual([
          expect.objectContaining({
            code: 1000,
            start: source.length,
            length: 0,
          }),
        ]);
      });
    });

    describe('mappings', () => {
      it('returns no mappings for the recovery stub', () => {
        expect(result.mappings).toEqual([]);
      });
    });

    describe('text', () => {
      it('retains the exported binding in valid TypeScript', () => {
        expect(
          consumerDiagnostics(
            result.text,
            'import { renamed } from "./producer"; export const result = renamed;',
          ),
        ).toEqual([]);
      });
    });
  });

  context.each([
    {
      context: 'an ordinary exported declaration',
      source:
        'export interface Shape<T> { id: T }\nconst broken = input |> parse(',
      consumer:
        'import type { Shape } from "./producer"; const shape: Shape<number> = { id: 1 };',
    },
    {
      context: 'an unfinished binding inside a nested namespace',
      source:
        'export namespace Models.Nested { export const { key: renamed } = input |> parse(',
      consumer:
        'import { Models } from "./producer"; export const result = Models.Nested.renamed;',
    },
    {
      context: 'an unfinished nested object binding',
      source: 'export const { nested: { inner } } = input |> parse(',
      consumer:
        'import { inner } from "./producer"; export const result = inner;',
    },
    {
      context: 'an unfinished array binding with an omitted element and rest',
      source: 'export const [first, , ...rest] = input |> parse(',
      consumer:
        'import { first, rest } from "./producer"; export const values = [first, rest];',
    },
    {
      context: 'an anonymous default class beside a generated-name collision',
      source:
        'export const __fts_default_0 = 1; export default class { read(): number { return 1; } }\nconst broken = input |> parse(',
      consumer:
        'import Model, { __fts_default_0 } from "./producer"; const value: number = new Model().read(); const existing: 1 = __fts_default_0;',
    },
    {
      context: 'a named default function with overloads',
      source:
        'export default function identity<T>(value: T): T; export default function identity(value: number, suffix: string): string; export default function identity(value: unknown, suffix?: string): unknown { return suffix ?? value; }\nconst broken = input |> parse(',
      consumer:
        'import identity from "./producer"; const value: string = identity<string>("ok"); const other: string = identity(1, "ok");',
    },
  ])('when recovery is needed for $context', ({ source, consumer }) => {
    describe('text', () => {
      it('keeps the exported declarations usable by the consumer', () => {
        const result = transformFutureTypeScript(source, 'incomplete.fts');
        expect(consumerDiagnostics(result.text, consumer)).toEqual([]);
      });
    });
  });
});
