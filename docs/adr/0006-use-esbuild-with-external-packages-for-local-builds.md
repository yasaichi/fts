# 6. Use esbuild with external packages for local builds

Date: 2026-08-21

## Status

Accepted

## Context

VS Code needs executable CommonJS entry points for the extension client and
language server. The official Volar starter builds both with esbuild and bundles
all packages except `vscode`.

This repository currently targets local Extension Development Host use, not a
VSIX or published extension. Bundling all installed packages produces about
16.2 MB of JavaScript in the measured spike, while leaving packages external
produces about 14.7 KB and relies on the local `node_modules` tree.

## Decision

Use esbuild directly from the package scripts for local extension builds,
following Volar's established toolchain instead of maintaining a custom build
program. Leave runtime packages external and rely on the locally installed
dependencies.

This is an explicit local-development compromise, not a distribution strategy.
Before producing a VSIX or publishing the extension, supersede this decision by
either bundling runtime packages or declaring and packaging them as production
dependencies.

## Consequences

The build remains close to Volar's recommended toolchain, fast, and expressible
without a custom build script.

The artifacts are not self-contained and fail without the matching installed
packages. Runtime packages are declared as dependencies, but the local build
still relies on the workspace `node_modules` tree and has not been packaged as a
VSIX. Distribution work must revisit this ADR rather than silently shipping the
local build.
