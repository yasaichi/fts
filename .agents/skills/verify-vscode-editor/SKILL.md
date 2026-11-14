---
name: verify-vscode-editor
description: Verify FTS in an actual VS Code editor, using an installed VSIX for distribution acceptance or an Extension Development Host for source verification. Exercise configured and inferred projects through the UI and report observed evidence; API tests alone do not prove visible editor behavior.
---

# Verify the FTS editor

Run the editor checks yourself using available desktop automation. This skill is
for this repository's VS Code integration, not a replacement for the lower-layer
test suites. A successful build or direct TypeScript LSP request does not prove
that the official extension, selected SDK, FTS extension and grammar work together
in a real editor.

Choose the target explicitly. Use **installed VSIX mode** after packaging,
dependency-bundling or SDK-loading changes. Use **development mode** for quick
source verification. A development-host run cannot satisfy installed-VSIX
acceptance, even if its editor observations pass. Keep target-specific setup and
the common UI checks in this skill rather than introducing a parallel skill.

## Establish the environment

Read the current versions and configuration before launching:

- `package.json` and the lockfile: supported Node/npm and pinned TypeScript.
- `packages/vscode/package.json` and `packages/vscode/src/extension.ts`: supported
  VS Code, language identity, and the official TypeScript extension registration.
- `packages/vscode/README.md` and `e2e/vscode.ts`: preview setup, selected-SDK
  requirements, the installed-extension runner and external fixtures.
- `.vscode/launch.json` and `fts.code-workspace`: development host arguments.
- `packages/content-mapper/test/fixtures/parity/tsconfig.json` and its
  `pipeline.fts`: the configured project and stable diagnostic fixture.

Record repository revision/local changes, application and extension versions,
selected SDK path/version, and which window/profile you control. Preserve existing
user buffers and edits. Use `direnv exec .` for repository commands when available.
Install locked dependencies if missing, then run `npm run build`; do not change a
version pin to get past setup failures.

For VSIX acceptance, also record the actual VSIX path and SHA-256. The source
revision alone is not evidence of which package was installed.

Use the desktop interaction tool available in the session (for example CUA's
native Visual Studio Code app control). Read that tool's documentation first.
Inspect the real UI, interact through its supported controls, and retain
screenshots or equivalent visible evidence of the observations below. If no tool
can control and observe the editor, report **BLOCKED** with that missing capability;
do not substitute mocks, source inspection or a headless LSP client for this run.

## Launch and connect the real extensions

### Installed VSIX mode

1. Run `WIREIT_LOGGER=simple FTS_VSIX_KEEP=1 npm run test:e2e:vscode`. It builds and packages FTS, installs
   the real VSIX and pinned official TypeScript extension outside the checkout,
   installs the supported SDK independently, and runs automated API acceptance.
   Record its result and retained `/tmp/fts-vsix-*` evidence directory. A failed
   automated run is not repaired by claiming the UI passed; diagnose it.
2. In a new VS Code window, use that directory's `extensions` directory and a
   fresh `profile-ui` user-data directory. Open its `inferred/pipeline.fts` as a
   loose file without adding a workspace folder. Launch with
   `--extensions-dir=<evidence>/extensions --user-data-dir=<evidence>/profile-ui`.
   Use the tested VS Code version. Do not pass `--extensionDevelopmentPath` for
   FTS or use repository `node_modules` as the SDK. Confirm the controlled window
   and installed FTS identity (`ftslang.ftslang-vscode`) in the Extensions UI.
   A fresh window can begin in Restricted Mode. Follow its normal Trust prompt for
   the fixture window only before checking extension activation. If approval is
   required, hand that decision to the user; do not disable Workspace Trust.
3. Enable the official TypeScript 7 extension through its normal command. Its
   default SDK currently lacks content mapper support. Observe FTS's unsupported
   SDK warning and **Select TypeScript Version** action. Confirm the grammar still
   works and FTS has not changed the user's SDK setting.
4. Select the prepared SDK at `<evidence>/consumer/node_modules/typescript` using
   the official settings and version picker. Follow normal trust, SDK and mapper
   permission prompts; do not disable these protections. Observe the selected
   version and path in the real UI/output. Restart the server if requested.
5. Run the common UI checks below on the loose file. For the configured project,
   open `<evidence>/consumer/src/pipeline.fts` and
   `<evidence>/consumer/src/index.ts`. Both are external files using the packed npm
   mapper. In this mode `result` is a **number**, `broken` has TS2322, and `index.ts`
   imports `result` from the original `.fts` declaration.
6. Switch to `<evidence>/SDK with spaces/node_modules/typescript` through the
   official picker/settings and restart the server. Confirm the new path and
   repeat hover plus one edit/diagnostic transition. The automated suite owns the
   detailed SDK lifecycle assertions; this step checks the visible setup flow.

API acceptance uses a separate test-driver extension and checks installed FTS
through VS Code APIs. It does not prove completion UI, notification actions,
grammar scopes, or permission prompts. Those observations belong to this skill.
Keep automated and UI results separate. Linux API acceptance runs under Xvfb in
CI; record which OS was actually observed through the UI.

### Development mode

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
   any prior values so changes can be restored when appropriate. Selecting
   **Use Workspace Version** can also write this setting into `fts.code-workspace`;
   capture its original contents and restore only this run's addition at cleanup.
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

In **installed VSIX mode**, use the retained external `consumer/src/pipeline.fts`
and `consumer/src/index.ts` for configured checks, and `inferred/pipeline.fts` for
inferred checks. Do not substitute repository files for those consumer files.

In **development mode**, use
`packages/content-mapper/test/fixtures/parity/pipeline.fts` for configured checks.
For inferred checks, save the snippet below outside the repository with no
ancestor `tsconfig.json` or `jsconfig.json`, and open it **without** adding a
workspace folder. Do not assume editable `examples/pipeline.fts` has stable content.

```fts
export const result = 1 |> % + 1;
export const broken: number = "wrong";
```

| Observation | Expected UI result |
| --- | --- |
| Grammar | For `.fts` in either mode/project type, language mode is **Future TypeScript**. **Developer: Inspect Editor Tokens and Scopes** shows `source.fts` and pipeline/topic token scopes. |
| Hover | `result` is `string` only in the development configured fixture; it is `number` in all other fixtures. The range covers the original identifier, and `%` has no synthesized-variable hover. |
| Completion | At EOF in an isolated unsaved edit, `input \|> Ma` in the development configured fixture, or `1 \|> Ma` in other fixtures, offers `Math` through Trigger Suggest. |
| Definition | Development configured: the pipeline call to `parse` navigates to its original declaration. Installed configured: imported `result` in `index.ts` navigates to `pipeline.fts`. Inferred: a reference to `result` navigates to its declaration in that file. |
| Diagnostics | Development configured: the final `%` passed to `Math.round` has **TS2345** at that topic. Installed configured and either inferred fixture: `broken` has **TS2322** at its original identifier. |
| Edit propagation | Development configured: remove `broken`, then undo. Other fixtures: replace `"wrong"` with `1`, then undo. In every case the diagnostic disappears and returns in the visible Problems/editor UI. |

Run completion probes at EOF without inserting a final newline, as during normal
typing. Use **Trigger Suggest** (Control+Space), not **Trigger Inline Suggestion**.
Confirm the selected command before accepting a fuzzy palette result: recently
used inline-suggestion commands can appear first. Prefer Quick Open for known
fixture paths and verify the selected file before navigating to a line.

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
- Keep editor evidence separate from the CLI/LSP integration results of
  `npm run test:integration`, which is also included in `npm run verify`. This skill
  does not authorize commit, push or publishing.

This workflow applies the verification-loop approach from
[Getting started with loops](https://claude.com/resources/articles/getting-started-with-loops):
encode the manual acceptance checks as agent-executable verification, inspect the
real result, and repair/recheck before declaring success.
