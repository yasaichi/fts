# 10. Use removable proposal adapters for pre-standardization experience

Date: 2026-08-26

## Status

Accepted

## Context

The [TC39 process](https://tc39.es/process-document/) describes Stage 2.7 as
testing and validation after a solution is complete enough that further work
requires feedback from tests, implementations, or usage. Entering Stage 3
requires sufficient testing and appropriate pre-implementation experience.

Mainstream toolchains reasonably wait for that maturity. For example,
TypeScript marks its [Pipeline Operator
issue](https://github.com/microsoft/TypeScript/issues/17718) as waiting for
TC39, while [V8 usually waits until Stage
3](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/docs/feature-launch-process.md#stage3plus)
before implementing JavaScript proposals. Experimental implementations and
Test262 can still advance a proposal, so this is not a deadlock in the formal
process. It is a practical gap in the experience available from typed
applications: editor behavior, type interactions, builds, tests, module
resolution, debugging, and migration are difficult to evaluate in ordinary
TypeScript projects while a proposal remains unsupported there.

Distributing early proposal tooling also creates an opposing risk. Babel's
[retrospective on Stage
presets](https://babeljs.io/blog/2018/07/27/removing-babels-stage-presets)
describes how blanket opt-in obscured which unstable proposals a project used
and could create pressure to preserve an early design or fragment the
ecosystem. Useful experimentation therefore needs a boundary that can follow
upstream changes instead of turning an installed syntax into a de facto
standard.

[ADR 2](0002-use-ordinary-typescript-as-the-compatibility-boundary.md)
establishes ordinary TypeScript as FTS's compatibility and exit boundary.
[ADR 7](0007-let-projects-select-features-while-fts-owns-implementations.md)
assigns proposal-specific implementations to first-party feature adapters.
This decision defines why those adapters exist before standardization and the
lifecycle constraints that keep their experiments removable.

## Decision

FTS will provide selected active proposals as first-party feature adapters.
Projects must opt in to each proposal explicitly. FTS will not provide blanket
Stage presets or automatically enable every proposal at a given TC39 stage.

Each adapter must identify the proposal revision and semantics it implements,
and FTS releases must make their relationship to that revision explicit. The
`.fts` source format is the experimental boundary; adapters must not claim
ordinary `.ts` files or present their syntax as a production-ready standard.

Adapters must follow upstream syntax and semantic changes, including through
intentional breaking releases. Existing usage is evidence to report, not a
reason to reject an upstream change. An adapter's lifecycle includes providing
a migration or codemod path when its source syntax changes.

FTS will turn reproducible findings from editor behavior, type interactions,
builds, tests, module resolution, debugging, and migration into feedback for
proposal champions. Adoption counts alone are not evidence of a sound design.

Reaching Stage 3 does not by itself end an adapter's lifecycle. Once native
support is available in the TypeScript version required by the adopting
project, FTS will deprecate the adapter and provide a path back to ordinary
`.ts` source without leaving an FTS-specific runtime behind.

## Consequences

Proposals can receive integration feedback that appears specifically in the
TypeScript ecosystem before native support exists. The common adapter
lifecycle gives feature addition, versioning, migration, and removal a
consistent purpose. Projects retain an exit to ordinary TypeScript rather than
acquiring a permanent language fork or runtime dependency, and FTS can remove
its implementation after upstream support becomes usable.

Pre-standardization use will sometimes require intentional breaking updates.
FTS must track proposal revisions and maintain migration tooling for every
adapter it supports. `.fts` source remains experimental: its proposal may
change, stall, or be withdrawn. Explicit boundaries and opt-in reduce, but do
not eliminate, the risks of premature stability and ecosystem fragmentation.
FTS also cannot guarantee when a proposal will receive native TypeScript
support or when an adapter can be retired.
