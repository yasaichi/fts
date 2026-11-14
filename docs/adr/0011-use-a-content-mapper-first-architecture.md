# 11. Use a content mapper-first architecture

Date: 2026-11-13

## Status

Accepted

Supersedes [ADR 0004](0004-use-volar-for-language-tooling.md),
[ADR 0008](0008-separate-language-tooling-packages.md), and
[ADR 0009](0009-use-unplugin-for-thin-build-adapters.md).

## Context

[TypeScript 7.1 Beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/)
provides content mappers for custom file extensions. The
[protocol](https://github.com/microsoft/typescript-go/pull/4712) supports project
lifecycles, generated TypeScript, span maps, and frontend diagnostics. TypeScript
projects and its editor extension now own the plumbing previously delegated to
Volar. FTS has no template-language service that would require a separate LSP
process after this migration.

TypeScript [declined mapping built-in extensions](https://github.com/microsoft/TypeScript/issues/65092).
The explicit `.fts` boundary in ADR 0002 therefore remains appropriate. Reference
implementations include [Vue's mapper migration](https://github.com/vuejs/language-tools/pull/6170),
[TSRX's investigation](https://github.com/tsrx-org/tsrx/issues/41), and
[MDX's mapper and VS Code registration](https://github.com/remcohaszing/mdx-content-mapper).

ADR 0009's build transform remains useful. Superseding its old language-core
ownership and Volar-facing mapping contract does not remove the host-neutral
Unplugin transform, SWC emit, or tested Vite adapter.

## Decision

Keep four workspace packages:

- `@ftslang/content-mapper` owns feature adapters, pure lowering, standard source
  maps for builds, native span maps, and a stdio JSON-RPC mapper executable.
- `ftslang-vscode` owns the TextMate grammar, language configuration, and native
  TypeScript extension registration for inferred projects. Configured projects
  are controlled exclusively by their `contentMappers` entries.
- `@ftslang/prettier-plugin` owns formatting support.
- `@ftslang/build` retains the thin Unplugin/SWC transform and the tested Vite
  adapter. It calls the mapper package's pure lowering entry point, without
  launching the mapper or sharing its editor failure policy.

Remove the Volar language plugin, the standalone language-server package, and
the LSP client. Do not introduce a replacement FTS checker.
[PR #9](https://github.com/yasaichi/fts/pull/9)'s Volar checker is superseded by
`tsc --runExternalCode`; closing that PR is a maintainer action.
Keep CI's existing formatting, lint, type, test and build checks, and add required
real TypeScript mapper integration tests rather than retaining checker plumbing.

Preserve ADR 0002/0003/0005/0006/0007/0010, lowering semantics, feature ownership
and selection policy, and the ordinary TypeScript exit boundary. Mapper options
do not expose arbitrary Babel plugins or workspace JavaScript configuration.

Declare the process command, relevant compiler options, and `dynamicConfig` in
`package.json`'s `typescript.contentMapper`. The current lowering does not depend
on compiler options or external configuration. Negotiate UTF-16 offsets and use
native span features to hide synthesized topic references from semantic edits
while preserving diagnostics on the original topic token. Return frontend syntax
errors and adapter static checks through `transform.diagnostics`. When lowering
fails, return an export-preserving stub and empty map to avoid cascading missing
export errors in importing modules.

Require consumers to opt in explicitly with `--runExternalCode`. Editor execution
remains behind TypeScript's Workspace Trust and mapper permission controls; the
FTS extension must not grant those permissions or alter configured projects.

Pin TypeScript to the exact beta version in executable configuration and the
lockfile. Capture legacy Volar diagnostics before removal, then require CLI parity
for filenames, positions, diagnostic codes, and error exit status. Use native
TypeScript LSP tests for complete ranges, hover, completion and definition. A
missing binary is a failure, never a skipped integration test. Recheck the API and
editor behavior before upgrading to RC or stable.

## Consequences

TypeScript owns project lifecycle, document integration, diagnostics projection,
and editor features. The dependency graph no longer includes Volar, an FTS LSP
server, or its client. Build and editor paths still share proposal semantics;
build failures continue to throw rather than using editor recovery stubs.

FTS depends on the evolving TypeScript beta protocol and editor registration API.
Track the [known upstream limitations](../../README.md#known-upstream-limitations)
without local workarounds. Beta-to-stable changes may require intentional updates.

Error recovery uses TypeScript's isolated declaration emit to preserve generic
signatures and namespace/enum members, normalizing declarations for ordinary
`.ts` content. Types inferred from incomplete expressions may be imprecise;
accurate type information resumes when syntax is repaired.
Grammar and native editor registration also need verification in a real VS Code
extension host in addition to the TypeScript LSP contract tests.

Native TypeScript exit codes apply, as covered by the
[CLI parity tests](../../packages/content-mapper/test/tsc.integration.test.ts).
