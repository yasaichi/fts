import {
  type BindingName,
  isClassDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isModuleBlock,
  isModuleDeclaration,
  isVariableStatement,
  type Statement,
  SyntaxKind,
} from 'typescript/ast';
import {
  createExportAssignment,
  createIdentifier,
  createKeywordTypeNode,
  createToken,
  createVariableDeclaration,
  updateClassDeclaration,
  updateFunctionDeclaration,
  updateModuleBlock,
  updateModuleDeclaration,
  updateVariableDeclarationList,
  updateVariableStatement,
} from 'typescript/ast/factory';
import { API, ScriptKind } from 'typescript/sync';

export function createExportStub(source: string): string {
  // Declaration emit retains generic signatures, member types and re-exports.
  // It parses one file without loading a project or executing content mappers.
  using syntax = new API();
  const { outputText } = syntax.transpileDeclaration(source, {
    fileName: 'recovery.ts',
  });
  using parsed = syntax.createSourceFile('recovery.d.ts', outputText, {
    scriptKind: ScriptKind.TS,
  });
  return [
    'export {};',
    ...normalizeDeclarations(parsed.sourceFile.statements, outputText).map(
      (statement) => syntax.printer.printNode(statement),
    ),
  ].join('\n');
}

function collectBindingNames(binding: BindingName): string[] {
  if (isIdentifier(binding)) return binding.text ? [binding.text] : [];
  return binding.elements.flatMap((element) =>
    element.name ? collectBindingNames(element.name) : [],
  );
}

function normalizeDeclarations(
  statements: readonly Statement[],
  text: string,
): Statement[] {
  let defaultExport: Statement | undefined;
  const normalized = statements.flatMap((statement): Statement[] => {
    if (isVariableStatement(statement)) {
      // Ambient destructuring is not valid in the mapper's ordinary .ts output.
      const declarations = statement.declarationList.declarations.flatMap(
        (declaration) =>
          isIdentifier(declaration.name)
            ? [declaration]
            : collectBindingNames(declaration.name).map((name) =>
                createVariableDeclaration(
                  createIdentifier(name),
                  undefined,
                  createKeywordTypeNode(SyntaxKind.AnyKeyword),
                ),
              ),
      );
      return [
        updateVariableStatement(
          statement,
          statement.modifiers,
          updateVariableDeclarationList(
            statement.declarationList,
            declarations,
          ),
        ),
      ];
    }
    if (isModuleDeclaration(statement) && statement.body) {
      const body = isModuleBlock(statement.body)
        ? updateModuleBlock(
            statement.body,
            normalizeDeclarations(statement.body.statements, text),
          )
        : (normalizeDeclarations(
            [statement.body],
            text,
          )[0] as typeof statement.body);
      return [
        updateModuleDeclaration(
          statement,
          statement.modifiers,
          statement.name,
          statement.attributes,
          body,
        ),
      ];
    }
    if (
      (isClassDeclaration(statement) || isFunctionDeclaration(statement)) &&
      statement.modifiers?.some(
        ({ kind }) => kind === SyntaxKind.DefaultKeyword,
      )
    ) {
      // Default declarations from .d.ts emit need an ambient local declaration
      // before they can be used as ordinary .ts content.
      let name = statement.name;
      if (!name) {
        let index = 0;
        while (text.includes(`__fts_default_${index}`)) index++;
        name = createIdentifier(`__fts_default_${index}`);
      }
      const modifiers = [
        createToken(SyntaxKind.DeclareKeyword),
        ...statement.modifiers.filter(
          ({ kind }) =>
            kind !== SyntaxKind.DefaultKeyword &&
            kind !== SyntaxKind.ExportKeyword,
        ),
      ];
      const declaration = isClassDeclaration(statement)
        ? updateClassDeclaration(
            statement,
            modifiers,
            name,
            statement.typeParameters,
            statement.heritageClauses,
            statement.members,
          )
        : updateFunctionDeclaration(
            statement,
            modifiers,
            statement.asteriskToken,
            name,
            statement.typeParameters,
            statement.parameters,
            statement.type,
            undefined,
          );
      // Overload signatures share one module-level default export.
      defaultExport ??= createExportAssignment(
        undefined,
        false,
        createKeywordTypeNode(SyntaxKind.AnyKeyword),
        name,
      );
      return [declaration];
    }
    return [statement];
  });
  return defaultExport ? [...normalized, defaultExport] : normalized;
}
