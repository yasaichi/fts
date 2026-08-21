# 5. Do not expose generated implementation details

Date: 2026-08-21

## Status

Accepted

## Context

Lowering proposed syntax can introduce identifiers and constructs that do not
exist in the source language. TypeScript diagnostics may need to map through
that generated code, but semantic features such as hover can accidentally show
generated names to the user. The first observed example was a pipeline topic
displaying a Babel temporary such as `_ref2`.

The problem applies to any feature adapter that synthesizes implementation
details, not only pipeline syntax.

## Decision

Expose a mapping capability only when its result is meaningful in terms of the
source language.

Diagnostics may map generated code back to the originating source construct.
Semantic features must not expose generated identifiers or syntax. If a useful
semantic result cannot be expressed by an ordinary source mapping, disable that
capability for the generated range until a source-level service can provide it.

Feature adapters own the concrete range calculation. Their implementation and
boundary cases belong in executable tests rather than this decision record.

## Consequences

Generated implementation details remain invisible across proposal features,
and diagnostics can still identify the relevant source construct.

Some source constructs will temporarily lack hover or navigation instead of
showing misleading generated information. Adding those interactions requires a
source-level representation or custom language service, with regression tests
at the mapping boundaries.
