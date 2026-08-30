# 11. Separate application checking from future declaration emit

Date: 2026-08-30

## Status

Accepted

## Context

FTS currently targets proposed JavaScript syntax in existing TypeScript
applications. Volar projects `.fts` into ordinary TypeScript for the editor;
Unplugin and SWC reuse the same lowering to build executable JavaScript. The
remaining semantic-check requirement is project diagnostics outside the editor,
primarily for CI.

This does not require declaration emit. Typed library authoring adds a separate
contract: either consumers process `.fts`, or FTS publishes ordinary JavaScript
and `.d.ts`. The former weakens the ordinary-TypeScript exit boundary from
[ADR 2](0002-use-ordinary-typescript-as-the-compatibility-boundary.md); the
latter requires project-wide declaration emit that the current per-module build
transform does not provide.

Volar exposes two relevant patterns. Astro uses `@volar/kit` as a programmatic
language-service checker. Vue's `vue-tsc` uses `runTsc` to place virtual `.vue`
code in the compiler pipeline, gaining `tsc` checking and declaration emit at
the cost of coupling to the installed `tsc` implementation. That coupling has
required compatibility work across TypeScript releases.

References: [Volar packages](https://github.com/volarjs/volar.js#packages),
[Astro checker](https://github.com/withastro/astro/blob/main/packages/language-tools/language-server/src/check.ts),
[`vue-tsc` contract](https://github.com/vuejs/language-tools/blob/master/packages/tsc/README.md),
[`vue-tsc` implementation](https://github.com/vuejs/language-tools/blob/master/packages/tsc/index.ts),
[`runTsc` compatibility example](https://github.com/volarjs/volar.js/issues/251).

## Considered options

The choices are exhaustive by product boundary. FTS can omit typed library
support, publish FTS-native source, or publish transparent ordinary artifacts.
The transparent option can use one compiler pipeline or separate checking from
declaration emit. JavaScript without types is not considered typed library
support.

### 1. Applications only

Use shared FTS language plugins and services for editor and CLI diagnostics;
keep Unplugin and SWC responsible for executable application builds.

- **Pros:** directly serves the current application goal; aligns editor and CLI
  diagnostics; avoids premature compiler-internal coupling; preserves every
  future library option.
- **Cons:** no `.d.ts` generation, typed library authoring, declaration build,
  or `tsc`-compatible command.

### 2. FTS-native libraries

Publish `.fts` and require compatible FTS tooling in consuming projects.

- **Pros:** needs no declaration emitter; preserves proposal syntax and
  FTS-specific source information.
- **Cons:** forces an experimental proposal revision and toolchain onto
  consumers; couples package consumption to FTS versions and build hosts;
  weakens removability and ordinary TypeScript as the ecosystem boundary.

### 3. Transparent libraries

Publish only ordinary JavaScript and `.d.ts`, so consumers do not need FTS.

#### 3a. Unified `tsc`-compatible pipeline

Use the Vue pattern: `runTsc` performs checking and declaration emit.

- **Pros:** reuses compiler support for declarations, maps, project references,
  build mode, and familiar `tsc` options; checking and emit share one project
  model.
- **Cons:** has the largest TypeScript compatibility surface. `runTsc` locates
  and transforms `typescript/lib/tsc`, so TypeScript changes can block upgrades
  until Volar and FTS adapt. It also makes broad compiler compatibility the
  foundation of a present requirement that only needs diagnostics, and may not
  compose every language-service diagnostic used by the editor.

#### 3b. Separate checker and declaration emitter

Use the language-service checker for applications and add declaration emit only
when library authoring becomes real. The emitter may later use `runTsc` or
another maintained compiler integration behind its own boundary.

- **Pros:** aligns current editor and CLI behavior; confines compiler coupling
  to declaration emit; chooses that integration against future TypeScript and
  Volar APIs; still produces consumer-transparent packages.
- **Cons:** two project consumers must agree on files, resolution, configuration,
  and lowering; declaration emit remains complex and needs conformance tests
  against the checker.

## Decision

Adopt option 1 now. FTS supports application use through editor diagnostics,
semantic checking, build, and test. The checker will reuse the editor's FTS
language plugins and services through a programmatic Volar checker. It will
call Volar directly instead of starting the LSP process for batch diagnostics
or rebuilding TypeScript project discovery and diagnostic mapping in a
handwritten compiler host. The checker will use the TypeScript version supported
and pinned by FTS; selecting arbitrary project-local TypeScript versions is
outside the current scope. The current Unplugin and SWC path remains an
executable build transform, not a declaration emitter.

Accept these current constraints:

- `.fts` does not produce `.d.ts`;
- FTS provides no `tsc`-compatible compiler or declaration build;
- raw `.fts` is not a supported package-consumer boundary;
- typed library authoring is outside the current product scope.

This decision is reversible. If a concrete library consumer appears after the
application workflow is stable, prefer option 3b: publish ordinary JavaScript
and `.d.ts` while keeping declaration emit separate from application checking.
`runTsc` remains a candidate inside that future declaration boundary if its
compiler coverage then outweighs its TypeScript-version coupling.

Library support requires a packed fixture proving that an FTS-authored package
contains ordinary runtime and type entry points, exposes no required raw `.fts`,
and type-checks and runs in an ordinary TypeScript consumer without FTS. Any
FTS-specific public guarantee must either have an ordinary TypeScript
representation or be excluded from the public contract.

## Consequences

The next checker can optimize for application diagnostics and editor parity
without making TypeScript compiler internals part of FTS's current release
surface. FTS cannot yet claim typed library authoring or collect declaration
emit feedback. Adding that support requires a separate implementation and
decision rather than silently expanding the Vite adapter or checker.
