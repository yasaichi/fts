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

[Babel](https://babeljs.io/) parses proposed syntax that TypeScript does not yet
understand and lowers it to ordinary TypeScript with source mappings. Each
feature adapter owns its proposal version, semantics, mappings, and additional
static checks. [Volar](https://volarjs.dev/) presents the lowered code to the
TypeScript language service and maps its diagnostics and semantic information
back to the original `.fts` source.

For builds, [Unplugin](https://unplugin.unjs.io/) provides thin host adapters
around the same core lowering. [SWC](https://swc.rs/) emits standard JavaScript,
and composed source maps point back to the original `.fts` file. Editor and
build integrations derive their outputs from the same lowering result so
proposal semantics have one implementation.

## Try the repository

`fts` and “Future TypeScript” are working names, and the packages and VS Code
extension are not yet published. Development requires Node.js 24.11 or later
and npm 11.10 or later.

```sh
npm install
npm run verify
```

Open the repository in VS Code and press `F5` to launch the local extension
demo with the current [`example fixture`](examples/pipeline.fts).

Accepted decisions and their trade-offs are recorded in
[`docs/adr/`](docs/adr/). Tests and executable configuration define current
behavior.
