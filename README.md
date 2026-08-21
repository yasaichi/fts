# Future TypeScript

An experimental `.fts` language toolchain for trying proposed JavaScript and
TypeScript syntax without forking TypeScript. The first vertical slice supports
the Hack-style Pipeline Operator with `%` as its topic token.

```ts
const result = input
  |> parse(%)
  |> format(%)
```

The `parse` and `format` declarations used by the demo are project-specific test
fixtures. They illustrate the selected syntax subset and are not examples quoted
from the Pipeline Operator proposal.

The source is lowered by Babel to virtual TypeScript. Volar maps TypeScript 6
diagnostics and hover results back to the original `.fts` document, while a VS
Code TextMate grammar supplies syntax highlighting.

## Requirements

- Node.js 24.11 or newer
- npm 11.10 or newer
- VS Code 1.125 or newer for the extension demo

The Node.js floor follows the Babel 8 runtime requirement. Dependency versions
are locked exactly, lifecycle scripts are disabled, and npm ignores releases
younger than seven days. npm 11.10 is the minimum because that release introduced
the `min-release-age` project setting.

## Try it

```sh
npm install
npm run verify
```

Open this repository in VS Code and press `F5`, then choose
`Launch Future TypeScript` if prompted. The Extension Development Host opens
[`examples/pipeline.fts`](examples/pipeline.fts), which demonstrates:

- syntax highlighting for TypeScript, `|>`, and `%`;
- a `string` hover on `result`;
- an intentional type error on the `%` passed to `Math.round`.

The diagnostic remains anchored to `%`, but Babel's generated `_ref` temporary
is deliberately excluded from semantic hover results.

## Commands

- `npm run check` — TypeScript-check the implementation.
- `npm test` — test lowering, mappings, and the real LSP boundary.
- `npm run build` — bundle the VS Code client and language server.
- `npm run verify` — run all three in that order.

## Architecture

- `src/language/lower-pipeline.ts` uses Babel's official proposal plugin and
  converts its source map into Volar mappings.
- `src/language/plugin.ts` exposes each `.fts` document as virtual TypeScript.
- `src/server.ts` composes Volar's language server with its TypeScript service.
- `src/extension.ts` starts that server through VS Code's language client.
- `syntaxes/` contains the VS Code language and TextMate contributions.

Topic positions come from Babel's `TopicReference` AST nodes. Because Babel
does not map generated temporary variables back to source, the adapter maps the
unmapped generated range between the surrounding Babel source-map boundaries
to that exact AST range for diagnostics only. It does not search for generated
names or infer topics from line layout.

## Current scope

Only `.fts` files and a synchronous function-call pipeline with one `%` per
stage are guaranteed. This slice does not provide `.ftsx`, transformed
TypeScript CLI output, semantic tokens, or a custom hover for the topic value.
Completions, definitions, references, rename, and formatting may be inherited
from Volar's TypeScript service, but they are not guaranteed or tested in this
slice.
