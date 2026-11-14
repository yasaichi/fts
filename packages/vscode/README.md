# Future TypeScript for VS Code

FTS adds Pipeline Operator syntax to `.fts` files, with syntax highlighting and
TypeScript-backed hover, completion, navigation and diagnostics.

## Preview setup

The preview requires VS Code 1.145.2 or newer, Microsoft's **TypeScript 7** extension
(`TypeScriptTeam.native-preview`, tested with 1.0.2), and **TypeScript 7.1.0-beta**.
The TypeScript 7 extension currently bundles 7.0.2, which does not support content
mappers. Install the supported SDK in your project:

```sh
npm install --save-dev --save-exact typescript@7.1.0-beta
```

Install the FTS VSIX. Enable **TypeScript: Enable TypeScript 7**, then set
`js/ts.tsdk.path` to your project's `node_modules/typescript` directory and select
that SDK using **TypeScript: Select TypeScript Version**. Allow workspace and
content mapper execution through VS Code's normal permission flow. FTS does not
change your SDK selection or trust settings.

The VSIX contains the FTS mapper and its JavaScript dependencies. It does not
contain TypeScript or require a checkout of the FTS repository. The selected
TypeScript SDK supplies the API and native compiler. Initial verification targets
macOS arm64 and Linux x64 on VS Code Desktop.

Loose `.fts` files use the mapper included in the VSIX. For a configured project,
install `@ftslang/content-mapper` and register it in `tsconfig.json`:

```json
{
  "contentMappers": [
    { "package": "@ftslang/content-mapper", "extensions": [".fts"] }
  ]
}
```

The npm packages are not yet public. Local preview projects can install their
packed tarballs. The extension does not replace npm packages needed by the CLI,
build host or formatter.

After switching SDKs, run **TypeScript: Restart TS Server**. FTS recreates its
mapper for the selected SDK. If TypeScript requests an extension-host restart
after an SDK update, follow that request.

## Local package and verification

From this package, `npm run package` builds `dist/ftslang.vsix` and `npm run
test:e2e` installs and tests it in an isolated VS Code environment. The same tasks
are available from the repository root with `--workspace ftslang-vscode`.

The automated checks verify installed-extension behavior through VS Code APIs.
The repository's `verify-vscode-editor` skill separately verifies the visible
editor, version picker, permission prompts and notification actions.
