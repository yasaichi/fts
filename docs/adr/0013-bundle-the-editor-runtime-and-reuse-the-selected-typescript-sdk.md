# 13. Bundle the editor runtime and reuse the selected TypeScript SDK

Date: 2026-11-14

## Status

Accepted

Supersedes [ADR 0006](0006-use-esbuild-with-external-packages-for-local-builds.md).

## Context

ADR 0006 deliberately relied on workspace dependencies for local editor builds
and deferred distribution. A VSIX installed without a repository checkout needs
its own FTS runtime and cannot use that local dependency tree.

The Microsoft TypeScript 7 extension exposes its selected SDK and a module loader
for companion processes. Its version 1.0.2 bundles SDK 7.0.2, which lacks the
content-mapper host implementation and the APIs used by FTS. The same extension
with SDK 7.1.0-beta supports those features. Content mappers are a
[TypeScript 7.1 feature](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/#content-mappers).

Bundling a compiler only for the FTS mapper cannot add content-mapper support to
the official extension's older server. Shipping another full SDK would also make
FTS responsible for native binaries and SDK selection/update flows.

## Decision

Use esbuild to bundle the FTS editor runtime, mapper, Babel and JSON-RPC
dependencies into the VSIX. Keep the extension entry CommonJS; use an ESM mapper
entry so its TypeScript API bindings can be loaded asynchronously. Include
source maps and notices for bundled dependencies.

Do not bundle TypeScript's compiler or native executable. Receive the official
extension's selected SDK after language-server initialization and pass its
package manifest path to the bundled mapper. Load API modules using TypeScript's
module loader. Recreate the mapper registration on initialization so SDK changes
and same-path upgrades do not retain modules from an old mapper process.

Certify the exact preview SDK declared by the content-mapper package. An
unsupported SDK or missing companion package gets setup guidance; FTS does not
download an SDK, change SDK selection, grant trust or enable mapper execution
permissions. A compatible SDK must be installed and explicitly selected during
this preview. A later compatible default SDK can use the same loading contract.

This decision changes editor distribution. The npm mapper keeps normal package
resolution and its own declared TypeScript dependency. Configured projects
continue to choose their npm mapper; the VSIX contributes its bundled mapper
only to inferred projects, preserving ADR 0011's ownership boundary.

Build one JavaScript-only VSIX, with initial verification on macOS arm64 and
Linux x64. Keep Marketplace/npm publication separate from artifact preparation.

## Consequences

FTS no longer depends on a checkout or extension-local node_modules at runtime.
The VSIX does not duplicate the compiler or need platform-specific compiler
packaging. SDK reuse shares files and version selection, not the official
language-server process: the mapper's synchronous API can still start a separate
compiler process from that SDK.

Users must select the supported SDK while the official default is too old.
Compatibility with a new SDK remains an explicit migration, not an automatic
version-range expansion. The editor build needs a small adapter that redirects
the npm mapper's TypeScript imports through the selected SDK loader.

Verify the actual installed VSIX with independent SDK and consumer directories,
rather than substituting a source-loaded extension. Automated Extension Host
tests own functional integration; the existing editor verification skill owns
visible editor controls, notification actions and permission prompts. Neither
successful source builds nor API assertions alone establish that visible UI
acceptance passed.
