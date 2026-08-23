# 4. Use Volar for language tooling

Date: 2026-08-21

## Status

Accepted

## Context

Proposal-aware tooling needs document lifecycle management, LSP transport,
virtual-code ownership, source mapping, TypeScript project integration, and a
VS Code client. Implementing these layers directly would recreate established
language-tooling infrastructure and make mapping behavior the project's
responsibility.

## Decision

Use Volar as the language-tooling framework and compose its TypeScript project
and services with the `.fts` language plugin. Follow the bootstrap shape in the
[official Volar
starter](https://github.com/volarjs/starter/blob/14c5ca6f4d4cfd3e397a403ceeb2f6f1c894ebdc/packages/language-server/src/index.ts)
for the installed API generation.

Custom code is limited to proposal parsing, lowering, mappings, syntax
highlighting, and semantic gaps not supplied by existing services. Exact Volar
and TypeScript versions belong in executable package configuration, not this
decision record.

## Consequences

The project inherits TypeScript diagnostics, hover, and other language features
without implementing an LSP server from first principles. Features inherited
from Volar may work even when they are not part of the tested contract; tests,
not incidental availability, define what this repository guarantees.

Volar and TypeScript APIs are version-sensitive and must be upgraded together,
with compatibility enforced by the lockfile and real LSP tests. Framework
behavior that cannot represent proposal-specific UX still requires a narrow
custom service or mapping rule.
