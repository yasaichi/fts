# fts

FTS is an experimental language and tooling layer for JavaScript and TypeScript
developers who want to evaluate future JavaScript features and stronger static
guarantees in existing TypeScript applications before standard toolchains
support them. It aims to improve JavaScript without requiring teams to adopt a
new language, proprietary runtime, or application-wide library model.

FTS does this by translating opt-in `.fts` source to ordinary TypeScript and
reusing existing editors, type checkers, build tools, packages, and JavaScript
runtimes. When standards and upstream tools catch up, the corresponding FTS
implementation can be removed without stranding the application.

## Why this exists

JavaScript and TypeScript still leave gaps in areas such as typed error
propagation, resource lifetime, pattern matching, and analysis across function
boundaries. A new language can address them directly, but asks developers to
leave or recreate their existing ecosystem. A runtime-like TypeScript library
preserves that ecosystem, but can take over control flow, errors, concurrency,
resources, and dependency injection until removing it requires an application
rewrite.

Standards need implementation and usage feedback before broad adoption, while
TypeScript and JavaScript engines reasonably wait for proposals to stabilize
before supporting them. This makes proposed features difficult to evaluate in
real typed applications when that feedback is most useful. FTS provides a
versioned, opt-in, and removable bridge for that period, turning editor, build,
test, and migration experience into feedback for upstream proposals. Ordinary
TypeScript remains the compatibility and exit boundary.

## How it works

[Babel](https://babeljs.io/) parses proposed syntax and lowers `.fts` to ordinary
TypeScript with source mappings. Each first-party feature adapter owns its
proposal revision, semantics, mappings, and additional static checks.

`@ftslang/content-mapper` exposes that lowering through the
[TypeScript 7.1 content mapper protocol](https://github.com/microsoft/typescript-go/pull/4712).
TypeScript owns document and project lifecycles, type checking, and projection of
editor features and diagnostics back to `.fts`. FTS frontend errors are returned
as mapper diagnostics. No separate FTS language server or checker is required.

The VS Code extension supplies the TextMate grammar, language configuration, and
mapper registration for inferred projects. Configured projects use their own
`tsconfig.json`. The Prettier plugin supplies `.fts` formatting.

For builds, `@ftslang/build/vite` uses [Unplugin](https://unplugin.unjs.io/) and
[SWC](https://swc.rs/) to emit JavaScript with composed source maps from the same
lowering. Type checking remains a separate TypeScript command.

## Configure TypeScript

Install the mapper and the exact supported beta in your project (the FTS packages
are currently local workspaces, not published packages):

```sh
npm install --save-dev typescript@7.1.0-beta @ftslang/content-mapper
```

Register the mapper explicitly in `tsconfig.json`:

```json
{
  "compilerOptions": { "noEmit": true, "strict": true },
  "contentMappers": [
    { "package": "@ftslang/content-mapper", "extensions": [".fts"] }
  ],
  "include": ["src"]
}
```

Run the compiler with explicit permission to execute external code:

```sh
npx tsc --runExternalCode
```

FTS never adds this flag for consumers.

### Known upstream limitations

Track [rename projection (#63879)](https://github.com/microsoft/TypeScript/issues/63879),
[new auto-import insertion (#64119)](https://github.com/microsoft/TypeScript/issues/64119),
and [outputExtension (#64120)](https://github.com/microsoft/TypeScript/issues/64120).
FTS does not patch these upstream behaviors. Use the Vite adapter for executable
JavaScript rather than relying on mapper emit. Generated temporaries and pipeline
topic tokens remain unavailable to semantic editing features.

The beta API is pinned to `7.1.0-beta`. Upgrades, including the stable release,
require the mapper protocol, CLI parity, and editor integration tests to pass
before changing the pin and lockfile.

## Try the repository

`fts` and “Future TypeScript” are working names, and the packages and VS Code
extension are not yet published. Development requires Node.js 24.11 or later
and npm 11.10 or later.

```sh
npm install
npm run verify
```

- [Development commands](package.json)
- [End-to-end tests](e2e/)
- [VS Code editor verification](.agents/skills/verify-vscode-editor/SKILL.md)
- [Architecture decisions](docs/adr/)
