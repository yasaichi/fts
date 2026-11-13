---
name: verify-vscode-editor
description: Verify FTS end-to-end in an actual VS Code Extension Development Host after changes to the editor extension, grammar, mapper integration, or editor setup. Exercise configured and inferred projects through the UI and report observed evidence; CLI/LSP tests alone are not editor E2E verification.
---

# Verify the FTS editor

Run the editor checks yourself using available desktop automation. This skill is
for this repository's VS Code integration, not a replacement for the lower-layer
test suites. A successful build or direct TypeScript LSP request does not prove
that the official extension, selected SDK, FTS extension and grammar work together
in a real editor.

## Establish the environment

Read the current versions and configuration before launching:

- `package.json` and the lockfile: supported Node/npm and pinned TypeScript.
- `packages/vscode/package.json` and `packages/vscode/src/extension.ts`: supported
  VS Code, language identity, and the official TypeScript extension registration.
- `.vscode/launch.json` and `fts.code-workspace`: development host arguments.
- `packages/content-mapper/test/fixtures/parity/tsconfig.json` and its
  `pipeline.fts`: the configured project and stable diagnostic fixture.

Record repository revision/local changes, application and extension versions,
selected SDK path/version, and which window/profile you control. Preserve existing
user buffers and edits. Use `direnv exec .` for repository commands when available.
Install locked dependencies if missing, then run `npm run build`; do not change a
version pin to get past setup failures.

Use the desktop interaction tool available in the session (for example CUA's
native Visual Studio Code app control). Read that tool's documentation first.
Inspect the real UI, interact through its supported controls, and retain
screenshots or equivalent visible evidence of the observations below. If no tool
can control and observe the editor, report **BLOCKED** with that missing capability;
do not substitute mocks, source inspection or a headless LSP client for this run.

## Launch and connect the real extensions

1. In VS Code, open this repository and run the **Launch Future TypeScript**
   launch configuration (`F5`). It builds the packages and opens the dedicated
   workspace in an Extension Development Host with the **FTS Mapper Test** profile.
   Verify the host title, profile, repository folder in Explorer, and loaded local
   FTS extension. A second window is expected. Close only a development host owned
   by this verification before relaunching; VS Code can reuse an old host with its
   previous workspace. Do not work in the ordinary window by mistake.
2. In that profile, ensure the official **TypeScript 7** extension
   (`TypeScriptTeam.native-preview`) is enabled. The supported baseline is version
   **1.0.2**; check current project requirements before changing it. A copy installed
   in another profile is insufficient. Reload this host if installation requires it.
   The built-in TypeScript extension alone does not supply the mapper integration.
3. Enable TypeScript 7 with **TypeScript: Enable TypeScript 7**. In the test
   profile's settings, set `js/ts.tsdk.path` to the absolute path of this
   repository's `node_modules/typescript`, and `js/ts.contentMappers.enabled` to
   `true`. Prefer profile settings over modifying tracked workspace files. Record
   any prior values so changes can be restored when appropriate.
4. Run **TypeScript: Select TypeScript Version** in the development host. Select
   **Use Workspace Version** and confirm the repository's pinned SDK version
   (currently **7.1.0-beta**), not the official extension's bundled **7.0.2** or
   built-in **6.0.3**. Observe the resolved version in the UI/output; setting a path
   is not proof that it was selected.
5. Keep workspace trust, SDK execution and content-mapper execution opt-in explicit.
   Use the normal permission flow for the repository under verification; do not
   suppress prompts, globally grant trust, or silently enable external-code
   execution in unrelated settings. If a required decision needs the user, hand
   over that decision and resume afterward.

If workspace SDK selection is missing, check the host/profile, TypeScript 7
activation, SDK installation and the absolute `js/ts.tsdk.path` before retrying.
Do not select an unrelated SDK or use a Nightly extension as an unexplained fix.

## Observe the application behavior

Open `packages/content-mapper/test/fixtures/parity/pipeline.fts` in the host for the
configured checks. Use this stable fixture rather than assuming the intentionally
editable `examples/pipeline.fts` still contains a particular invalid function call.
For inferred checks, save the snippet below in a new temporary directory outside
the repository, verify that no ancestor has a `tsconfig.json` or `jsconfig.json`,
and open the file in the same host **without** adding a folder or configuration.
This tests the FTS extension's inferred-project mapper contribution rather than
configured-project discovery.

```fts
export const result = 1 |> % + 1;
export const broken: number = "wrong";
```

| Observation | Configured fixture | Inferred file |
| --- | --- | --- |
| Grammar | Language mode is **Future TypeScript**; **Developer: Inspect Editor Tokens and Scopes** shows `source.fts`, with pipeline/topic token scopes | Same language mode and grammar scopes |
| Hover | Hover the `result` declaration: `result: string`, with the range over the original identifier; topic `%` has no synthesized-variable hover | Hover `result`: `result: number` |
| Completion | In an isolated unsaved edit, type `input \|> Ma` and invoke completion: `Math` is offered | Type `1 \|> Ma` in an isolated unsaved edit: `Math` is offered |
| Definition | Go to definition on a pipeline call to `parse`: lands on its declaration in the original `.fts` file | Add a reference to `result`: go to definition lands on the declaration in this file |
| Diagnostics | The final `%` passed to `Math.round` has **TS2345** at the original topic, not generated code | `broken` has **TS2322** at the original identifier |
| Edit propagation | Remove the invalid `broken` statement: its diagnostic disappears; undo: it returns | Replace `"wrong"` with `1`: the diagnostic disappears; undo: it returns |

Restore each temporary buffer edit before the next observation so an unfinished
completion probe cannot mask the diagnostic check. Use the editor's actual
completion, hover, definition and Problems/diagnostic UI, not direct provider or
server calls. Record before/after evidence for edit propagation. Detailed syntax,
span-boundary and declaration-shape matrices belong to the existing lower-layer
tests; do not replicate them in this E2E workflow.

## Repair and reverify

If an expected observation fails, capture expected versus actual behavior, the
file/project mode, selected SDK, and the **TypeScript 7** output channel's relevant
startup/mapper errors. Distinguish a setup failure from a product failure. Check
profile-local extension activation, trust, SDK selection and mapper permission
before changing implementation. Highlighting alone proves neither TypeScript
activation nor mapper registration.

Fix failures within the authorized task, rebuild affected packages, and relaunch
or reload as needed. Repeat the failing observation and the connected checks
that the fix can affect, in both project modes when registration/SDK behavior
changes. Continue until the selected checks pass or a concrete tool, permission
or environment blocker prevents further verification. Avoid retrying an unchanged
blocked setup. Never weaken expected results or patch known upstream rename,
new-auto-import or output-extension limitations to make this matrix green; consult
the README's upstream issue links if those features are explicitly requested.

## Finish with evidence

- Restore only this run's buffer/configuration changes and remove its temporary
  file/directory. Preserve user edits, ordinary profiles and pre-existing windows.
  State any retained test-profile setup so it can be reused.
- Report **PASS**, **FAIL** or **BLOCKED** for this editor E2E run, with a short
  configured/inferred result table, actual versions, evidence paths and relevant
  output errors. Identify skipped observations and why; skipped required rows
  cannot count as a full PASS. If checks remain unavailable, say what remains
  unverified rather than calling the implementation ready.
- Keep editor evidence separate from results of `npm run verify` and
  `npm run test:mapper`. This skill does not authorize commit, push or publishing.

This workflow applies the verification-loop approach from
[Getting started with loops](https://claude.com/resources/articles/getting-started-with-loops):
encode the manual acceptance checks as agent-executable verification, inspect the
real result, and repair/recheck before declaring success.
