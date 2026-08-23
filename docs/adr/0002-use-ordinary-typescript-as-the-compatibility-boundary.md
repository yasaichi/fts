# 2. Use ordinary TypeScript as the compatibility boundary

Date: 2026-08-21

## Status

Accepted

## Context

Proposed JavaScript syntax is not understood by the current TypeScript parser.
Forking TypeScript would make editor support, compiler updates, and migration
back to the standard ecosystem expensive. Using `.ts` directly would also make
VS Code's built-in TypeScript language service compete with proposal-aware
tooling for the same document.

The project needs an explicit opt-in source format, access to the existing
TypeScript checker, and an exit path that does not strand source code in a
custom toolchain.

## Decision

Treat `.fts` as a source language that projects into ordinary TypeScript.

The editor exposes a virtual `.ts` document to the TypeScript Language Service.
Future command-line transforms must make ordinary `.ts` available as an
intermediate artifact before any JavaScript emit. Editor and build transforms
must share the same lowering semantics.

Do not fork TypeScript or claim ownership of ordinary `.ts` documents. Keep
proposal syntax behind the `.fts` language boundary and preserve a path for
committing generated TypeScript into a conventional project.

## Consequences

The project can reuse TypeScript's checker and the surrounding ecosystem while
keeping proposal syntax removable. Standardization can eventually eliminate a
feature adapter instead of requiring a source rewrite away from a custom
runtime.

Every transformation now requires accurate source mappings. Editor and future
build paths can diverge unless shared fixtures test them. Tooling must also own
the `.fts` language id and file association. Additional source variants require
separate ownership decisions and implementations.
