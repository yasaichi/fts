# 3. Use Babel as the initial proposal frontend

Date: 2026-08-21

## Status

Accepted

## Context

JavaScript proposals evolve independently of TypeScript and may require a
proposal-aware parser, a semantics-preserving transform, and source maps before
the standard toolchain supports them. Maintaining a general-purpose parser or
forking a compiler would make each experiment expensive and hard to remove.

The project prefers an existing reference implementation when one is available,
but future proposals may not all be supported by the same frontend.

## Decision

Use the pinned Babel parser and official proposal plugins as the initial
proposal frontend.

Keep proposal names, versions, parser options, and transforms inside independent
feature adapters. The rest of the language tooling consumes ordinary TypeScript
and mappings rather than Babel-specific ASTs. Babel is not required for a future
feature whose semantics are better represented by another maintained frontend.

## Consequences

Babel provides maintained implementations and source maps for the current
experiments, reducing the custom parser and transformer surface.

Parsing and transformation are synchronous JavaScript work on the language
server event loop and may become a latency or memory bottleneck. A feature
adapter can move to a native implementation only when differential tests show
equivalent lowering and mappings. Babel and TypeScript ASTs remain separate;
only generated text and mapping data cross the compatibility boundary.
