# 9. Use Unplugin behind a host-neutral build package

Date: 2026-08-24

## Status

Accepted

## Context

[ADR 2](0002-use-ordinary-typescript-as-the-compatibility-boundary.md)
defines `.fts` as a source language that lowers to ordinary TypeScript. The
first implementation used that lowering only to construct the virtual document
and Volar mappings needed by the editor. Projects also need to execute `.fts`
through build and test tools without introducing a second implementation of
proposal semantics.

Proposal lowering and build-host integration have different responsibilities.
The lowering layer understands FTS syntax and produces ordinary TypeScript with
a source map. A host adapter decides which modules to transform and translates
that result into the host's plugin contract. Proposal parsing, feature-specific
metadata, and editor recovery policy do not belong in a build adapter.

The reusable build transform cannot depend on a later host-specific pass to
recognize TypeScript returned for the custom `.fts` extension. Its portable
output contract must therefore be executable JavaScript and a source map back
to the original `.fts`, while ordinary TypeScript remains the explicit
intermediate compatibility boundary. Invalid source must fail a build rather
than use the identity fallback intended for incomplete editor documents.

Build tools expose different plugin entry points, but several share the same
module-transform shape. Unplugin can generate those adapters from one transform
implementation. Generating an adapter does not by itself establish support for
that host; each public integration still needs conformance tests for execution,
errors, and source maps.

Unplugin's [plugin conventions] recommend naming packages after the mechanism,
such as `unplugin-feature/vite`. Product libraries use several other patterns:
[UnoCSS] exposes `unocss/vite`, [Tailwind CSS] publishes
`@tailwindcss/vite`, [Svelte] publishes `@sveltejs/vite-plugin-svelte`, and
[MDX] names separate packages after host mechanisms. FTS needs a name for the
product capability rather than a commitment to one adapter implementation.

The shared transform also needs to remove TypeScript syntax after FTS lowering.
Both esbuild 0.28.2 and `@swc/core` 1.15.47 produced executable ESM and a
composed map that traced the representative pipeline result to its original
`.fts` symbol. In warm sequential measurements on 2026-08-24 using macOS arm64
and Node.js 26.1.0, SWC transformed the 98-byte lowered fixture about 9.4 times
as fast as esbuild. Across the repository's 14 production TypeScript files, it
was about 5.5 times as fast. Three runs with alternating measurement order gave
the same direction.

[plugin conventions]: https://unplugin.unjs.io/guide/plugin-conventions.html
[UnoCSS]: https://unocss.dev/integrations/vite
[Tailwind CSS]: https://tailwindcss.com/docs/installation/using-vite
[Svelte]: https://svelte.dev/packages
[MDX]: https://mdxjs.com/packages

## Decision

Expose a feature-neutral operation from `@ftslang/core` that returns ordinary
TypeScript and an encoded standard source map. Derive editor mappings from the
same internal lowering result, but keep Volar types, feature-specific metadata,
and editor recovery behavior out of the build-facing contract.

Put build-host integrations in the product-facing `@ftslang/build` package.
Use Unplugin internally to implement the shared module transform and generate
thin host adapters. Do not expose Unplugin as the product identity or treat all
adapters it can generate as supported. A host receives a public subpath only
after its runtime, failure, and source-map behavior has conformance coverage.

The shared Unplugin transform passes the ordinary TypeScript intermediate to
SWC, emits ESM JavaScript, and composes the SWC map with the core lowering map
using the maintained jridgewell source-map implementation. A missing emit map
or an invalid `.fts` module is a build error.

Use SWC rather than esbuild for this host-neutral emit step. The measured speed
advantage applies to the transform contract shared by adapters, not to the first
supported host. This decision does not replace esbuild as the repository's
local package bundler under
[ADR 6](0006-use-esbuild-with-external-packages-for-local-builds.md).

Publish only adapters whose host behavior has conformance coverage. At the time
of this decision, that set contains only Vite, exposed as
`@ftslang/build/vite` with `fts` as the adapter function. Vitest is covered
through the same Vite configuration rather than a test-runner-specific FTS
transform. This support sequence does not give Vite a privileged place in the
architecture.

## Consequences

Build and editor consumers share proposal semantics and the ordinary TypeScript
boundary without sharing consumer-specific mappings or failure policy. A new
build host can reuse the same JavaScript transform, but its adapter remains a
deliberate support commitment rather than an automatically published Unplugin
entry point.

Consumers install a package named for FTS build integration, so replacing
Unplugin would not require a public package rename. The broad `build` namespace
must remain limited to build-time integrations; compiler, editor, formatter,
and linter APIs retain their own ownership boundaries.

The build path performs an additional native transform and owns SWC as a runtime
dependency. Its configuration is larger than esbuild's, and the measured macOS
arm64 native binary was approximately 25 MB rather than 10 MB. The repository
continues to carry esbuild for local package bundling.

The emitted source map remains traceable to the original `.fts`, and build parse
failures remain visible. Extensionless resolution, semantic checking,
formatting, linting, HMR, and integrations other than Vite are not established
by this decision.
