# 1. Record architecture decisions

Date: 2026-08-21

## Status

Accepted

## Context

Architecture explanations become misleading when they are edited in place or
left behind after the code changes. This repository still needs durable context
for choices that cannot be recovered from the implementation alone, including
rejected alternatives and accepted compromises.

## Decision

We will use Architecture Decision Records, as [described by Michael
Nygard](http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions).

ADRs record architectural choices, technology selections, and compromises with
their status and consequences. Tests and executable configuration remain the
source of truth for current behavior. The README remains a concise entry point
instead of duplicating the architecture.

Accepted ADRs are immutable. A changed decision must be recorded in a new ADR
that supersedes the old one. We use `adr-tools` to create, link, and supersede
records.

## Consequences

Historical reasoning remains discoverable without presenting an old decision
as current. Contributors must consult both ADR status and executable tests.
There is some maintenance overhead when a decision changes, and purely
descriptive documents should not repeat information already captured here.

For the repository tooling, see Nat Pryce's
[adr-tools](https://github.com/npryce/adr-tools).
