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
The superseded PR #9 checker used exit 1 for diagnostics and exit 2 for execution
errors. Native `tsc --noEmit` uses exit 2 for diagnostics (outputs skipped) and exit
0 for success. The migration preserves diagnostic locations/codes and successful
versus failed checks, adopting native exit codes without a compatibility wrapper.

FTS never adds this flag for consumers. For editor setup and manual verification,
see [VS Code editor check](#vs-code-editor-check) below.

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
npm run test:mapper
```

`npm run test:mapper` requires the installed
TypeScript binary and tests the real CLI and TypeScript language server; a missing
or incompatible binary fails the suite. These tests do not launch the VS Code
extension host or verify its connection to the official TypeScript extension.

### VS Code editor check

The local FTS extension supplies grammar and mapper registration. Hover,
completion, definitions, and diagnostics are supplied by the separate official
[TypeScript 7 extension](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview)
(`TypeScriptTeam.native-preview`). The built-in TypeScript extension alone does
not provide this integration.

1. Open this repository folder in VS Code 1.132 or later. Close any existing FTS
   Extension Development Host window, then press `F5` and choose **Launch Future
   TypeScript** if prompted. The launch configuration builds the packages and
   opens [the dedicated workspace](fts.code-workspace), which
   contains this repository, together with
   [`examples/pipeline.fts`](examples/pipeline.fts) in an Extension Development
   Host using the persistent `FTS Mapper Test` profile. A separate workspace file
   is needed because VS Code excludes a folder already open in another window
   from the development host's launch targets. Confirm that the title contains
   **Extension Development Host** and Explorer contains the `fts` folder. No
   manual **Open Folder** or **Add Folder to Workspace** step is needed. Close an
   old development host before relaunching after launch configuration changes;
   VS Code otherwise reloads that host with its existing workspace.
2. In that development window, install the official TypeScript 7 extension,
   version **1.0.2**, using the Extensions view's **Install Another Version**
   action if necessary. Install it in `FTS Mapper Test`, not just your normal
   profile. Reload the development window if prompted. Future launches reuse
   this profile and its installed extensions.
3. Trust the repository workspace. Run **TypeScript: Enable TypeScript 7** and
   set the following in that window's workspace settings:

   ```json
   {
     "js/ts.tsdk.path": "./node_modules/typescript",
     "js/ts.contentMappers.enabled": true
   }
   ```

4. Run **TypeScript: Select TypeScript Version**, choose **Use Workspace
   Version**, and confirm **7.1.0-beta**. Approve use of the workspace SDK and
   content mapper when prompted. Extension 1.0.2 bundles TypeScript 7.0.2, so
   installing it alone does not select the supported beta. A separate Nightly
   extension is unnecessary.
5. Check both project modes below. The FTS extension registers `.fts` for
   discovery in both modes. A configured project uses its own `contentMappers`
   entry; only an inferred project receives the extension's mapper manifest.

| Check | Configured project: `examples/pipeline.fts` | Inferred project: a saved `.fts` file outside any `tsconfig.json` |
| --- | --- | --- |
| Grammar | Language mode is Future TypeScript; inspect tokens to confirm `source.fts` and pipeline/topic highlighting | Same |
| Hover | `result` has type `string` | Use the snippet below; `result` has type `number` |
| Completion | Temporarily type `input \|> Ma` and invoke completion; `Math` is offered | Temporarily type `1 \|> Ma`; `Math` is offered |
| Definition | Go to definition on the call to `parse` reaches its declaration | Add a reference to `result`; go to definition reaches its declaration |
| Diagnostics | The final `%` passed to `Math.round` reports TS2345 | `broken` reports TS2322 |
| Edit recovery | Remove the final invalid stage and confirm its diagnostic disappears; undo the edit | Change `"wrong"` to `1` and confirm its diagnostic disappears; undo the edit |

For the inferred project, save this snippet in a temporary directory outside the
repository, with no ancestor `tsconfig.json`, and open it in the same development
window:

```fts
export const result = 1 |> % + 1;
export const broken: number = "wrong";
```

If only highlighting works, check that the official extension is enabled in the
development window, TypeScript 7 is enabled, the selected SDK is 7.1.0-beta, and
workspace trust and mapper execution permission have been granted. Inspect the
**TypeScript 7** output channel for startup or mapper errors. Restore the example
after testing. Manual editor verification remains required even when both npm
verification commands pass.

Accepted decisions and their trade-offs are recorded in
[`docs/adr/`](docs/adr/). Tests and executable configuration define current
behavior.
