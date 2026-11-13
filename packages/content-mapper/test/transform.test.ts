import { parseSync, types } from '@babel/core';
import { createFileSystemWithLib } from 'typescript/fs';
import { API, type Diagnostic, ModuleKind } from 'typescript/sync';
import { beforeAll, describe as context, describe, expect, it } from 'vitest';
import {
  type TransformResult,
  transformFutureTypeScript,
} from '../src/transform.js';

function exportedNames(text: string): string[] {
  const ast = parseSync(text, {
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript'] },
  });
  if (!ast) throw new Error('Expected a valid TypeScript module');
  return ast.program.body
    .flatMap((statement) => {
      if (!types.isExportNamedDeclaration(statement)) return [];
      return [
        ...(statement.declaration
          ? Object.keys(types.getBindingIdentifiers(statement.declaration))
          : []),
        ...statement.specifiers.map(({ exported }) =>
          types.isIdentifier(exported) ? exported.name : exported.value,
        ),
      ];
    })
    .toSorted();
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
        expect(exportedNames(result.text)).toEqual(['result']);
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
      it('returns valid TypeScript', () => {
        expect(() =>
          parseSync(result.text, { parserOpts: { plugins: ['typescript'] } }),
        ).not.toThrow();
      });
    });
  });

  context.each([
    {
      context: 'a generic type alias with a default parameter',
      source: 'export type Result<T, U = string> = [T, U];',
      consumer:
        'import type { Result } from "./producer"; const one: Result<number> = [1, "ok"]; const two: Result<number, boolean> = [1, true];',
    },
    {
      context: 'a generic function',
      source: 'export function identity<T>(value: T): T { return value; }',
      consumer:
        'import { identity } from "./producer"; const value: string = identity<string>("ok");',
    },
    {
      context: 'a generic class with a generic method',
      source:
        'export class Model<T> { value?: T; read<U>(value: U): U { return value; } }',
      consumer:
        'import { Model } from "./producer"; const model: Model<string> = new Model<string>(); const value: number = model.read<number>(1);',
    },
    {
      context: 'a generic interface',
      source: 'export interface Shape<T> { id: T }',
      consumer:
        'import type { Shape } from "./producer"; const shape: Shape<number> = { id: 1 }; const id: number = shape.id;',
    },
    {
      context: 'a nested namespace',
      source:
        'export namespace Models.Nested { export interface Shape<T> { id: T } }',
      consumer:
        'import type { Models } from "./producer"; const shape: Models.Nested.Shape<number> = { id: 1 };',
    },
    {
      context: 'enum member types and values',
      source: 'export enum State { Ready, Done = "done" }',
      consumer:
        'import { State } from "./producer"; const ready: State.Ready = State.Ready; const done: string = State.Done;',
    },
    {
      context: 'a locally aliased generic declaration',
      source: 'class Model<T> { value?: T } export { Model as Renamed };',
      consumer:
        'import { Renamed } from "./producer"; const model: Renamed<string> = new Renamed<string>();',
    },
    {
      context: 'an anonymous default class',
      source: 'export default class<T> { value?: T }',
      consumer:
        'import Model from "./producer"; const model: Model<string> = new Model<string>();',
    },
    {
      context: 'a named default function with generic overloads',
      source:
        'export default function identity<T>(value: T): T; export default function identity(value: number, suffix: string): string; export default function identity(value: unknown, suffix?: string): unknown { return suffix ?? value; }',
      consumer:
        'import identity from "./producer"; const value: string = identity<string>("ok"); const other: string = identity(1, "ok");',
    },
    {
      context: 'nested and array export bindings',
      source:
        'declare const input: any; declare const list: any; export const { key: renamed, nested: { inner } } = input; export const [first, , ...rest] = list;',
      consumer:
        'import { renamed, inner, first, rest } from "./producer"; const values = [renamed, inner, first, rest];',
    },
    {
      context: 'a generic export assignment',
      source:
        'function identity<T>(value: T): T { return value; } export = identity;',
      consumer:
        'import identity = require("./producer"); const value: string = identity<string>("ok");',
    },
  ])(
    'when $context precedes an unfinished pipeline',
    ({ source, consumer }) => {
      let diagnostics: readonly Diagnostic[];

      beforeAll(() => {
        const result = transformFutureTypeScript(
          `${source}\nconst broken = input |> parse(`,
          'incomplete.fts',
        );
        // Check export use directly, without project discovery or LSP transport.
        using checker = new API();
        using snapshot = checker.createSnapshot({
          fileSystem: createFileSystemWithLib([
            ['/producer.ts', result.text],
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
        diagnostics = [
          ...program.getSyntacticDiagnostics(),
          ...program.getSemanticDiagnostics(),
        ];
      });

      describe('text', () => {
        it('preserves the declaration shape used by the consumer', () => {
          expect(diagnostics).toEqual([]);
        });
      });
    },
  );
  // Recovery invokes the real native parser once per lexical context, without
  // repeating project discovery, LSP transport or consumer checking.

  context.each([
    {
      context: 'template interpolation',
      source: 'const template = `value ${value}`;',
    },
    {
      context: 'nested templates',
      source: 'const nested = `outer ${`inner ${ { value: 1 }.value }`}`;',
    },
    { context: 'a regexp opening brace', source: 'const regex = /{/;' },
    {
      context: 'a returned regexp closing brace',
      source: 'function read() { return /}/; }',
    },
    {
      context: 'a regexp after a control statement',
      source: 'function read() { if (value) /}/.test(value); }',
    },
    {
      context: 'division after an identifier',
      source: 'const division = numerator / denominator;',
    },
    {
      context: 'division after a function expression',
      source: 'const quotient = function() {} / 2;',
    },
    {
      context: 'division after an object literal',
      source: 'const quotient = {} / denominator;',
    },
  ])('when $context precedes an unfinished exported binding', ({ source }) => {
    let result: TransformResult;

    beforeAll(() => {
      result = transformFutureTypeScript(
        `${source} export const named = input |> parse(`,
        'incomplete.fts',
      );
    });

    describe('diagnostics', () => {
      it('reports the lowering failure', () => {
        expect(result.diagnostics).toHaveLength(1);
      });
    });

    describe('mappings', () => {
      it('returns no mappings for the recovery stub', () => {
        expect(result.mappings).toEqual([]);
      });
    });

    describe('text', () => {
      it('preserves the later export', () => {
        expect(exportedNames(result.text)).toEqual(['named']);
      });
    });
  });
});
