# fts

> The project, package, and product names are not final. `fts` is the current
> repository identifier; “Future TypeScript” is a working description.

## Motivation

TypeScript already fits the way JavaScript software is distributed: existing
packages, runtimes, build tools, editors, and deployment targets continue to
work. Replacing that ecosystem with a new language or runtime would make useful
ideas much harder to adopt.

At the same time, some language features and static guarantees cannot be
expressed naturally with today's TypeScript syntax and type system. Implementing
them only through a library can make an application's control flow and domain
model permanently depend on that library's abstractions. Waiting for every idea
to land upstream makes it difficult to evaluate those ideas in real TypeScript
projects.

## Goal

FTS explores whether proposed language features and additional static analysis
can be applied directly to the TypeScript workflow as removable development-time
tooling. It reuses the existing TypeScript checker and editor ecosystem, filling
only the gaps that current tools cannot cover.

The compatibility boundary is ordinary TypeScript. Application code should not
require a proprietary runtime, and adopting an experiment should preserve a
mechanical path back to the standard JavaScript and TypeScript ecosystem. When
standards and upstream tools catch up, the corresponding syntax transform or
analysis should be deleted rather than retained as permanent infrastructure.

The architectural rationale and accepted compromises are recorded in
[`docs/adr/`](docs/adr/). Tests define the behavior that works today.

## Try it

```sh
npm install
npm run verify
```

Open the repository in VS Code and press `F5` to start the local extension demo.

## Current distribution status

The build currently supports local extension development only and is not
packaged for distribution. See
[ADR 6](docs/adr/0006-use-esbuild-with-external-packages-for-local-builds.md)
before changing or distributing the build.
