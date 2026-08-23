# 8. Separate language tooling packages

Date: 2026-08-22

## Status

Accepted

## Context

The initial vertical slice keeps proposal lowering, the LSP process, the VS Code
client, and extension metadata in one package. Their deployment and reuse
boundaries are different: an editor-independent server can support multiple LSP
clients, while the VS Code client and TextMate grammar are specific to one
editor.

The lowering implementation is also a separate concern. [ADR
2](0002-use-ordinary-typescript-as-the-compatibility-boundary.md) requires editor
and future command-line transforms to share lowering semantics, so leaving that
code inside the server would require extracting it when the command-line path
is added.

Volar's [recommended project
structure](https://volarjs.dev/guides/file-structure/) separates the language
server and VS Code client in a monorepo. Astro follows that boundary and keeps
its language core inside the server, while Vue also publishes its reusable
language core separately.

## Decision

Use a private npm workspace with three packages:

- `language-core` owns feature adapters, proposal lowering, mappings, and the
  Volar language plugin;
- `language-server` owns the editor-independent LSP process and executable,
  and depends on `language-core`;
- `vscode` owns the VS Code client, extension manifest, language configuration,
  and TextMate grammar, and launches the language server.

Keep cross-package examples and architectural documentation at the repository
root. The root package only orchestrates workspace commands.

Do not add separate language-service, shared, command-line, or per-feature
packages until they have an independent implementation, consumer, or release
boundary. Keep built-in feature adapters under `language-core` for now, as
established by [ADR
7](0007-let-projects-select-features-while-fts-owns-implementations.md).

Continue using npm workspaces. This separation does not itself justify adding a
monorepo task runner or changing package managers.

## Consequences

The language server becomes a real client-independent package and the VS Code
extension no longer owns server implementation code. Future editor clients can
launch the same executable, and future command-line tooling can reuse lowering
without importing the LSP process.

Package manifests now express runtime ownership instead of combining every
dependency at the root. Builds, checks, and tests must run in dependency order,
and cross-package integration tests must detect drift in shared protocol values
such as the language identifier.

The workspace adds configuration overhead. Avoiding speculative packages keeps
that overhead proportional to current architectural boundaries. Distribution
still follows the local-build compromise in [ADR
6](0006-use-esbuild-with-external-packages-for-local-builds.md); this decision does
not make the extension or server publishable by itself.
