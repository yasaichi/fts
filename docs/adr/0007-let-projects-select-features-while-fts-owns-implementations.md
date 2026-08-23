# 7. Let projects select features while FTS owns implementations

Date: 2026-08-21

## Status

Accepted

## Context

Projects need to choose which proposed syntax they adopt and, where a proposal
allows it, which source-level semantics they use. Babel exposes this choice as a
list of installed plugins and plugin options. For example, its [Pipeline
Operator plugin](https://babeljs.io/docs/babel-plugin-proposal-pipeline-operator)
requires a proposal variant and, for Hack-style pipes, a topic token.

An FTS feature is more than a Babel transform. It also owns parser options,
source mappings, language-service capabilities, syntax highlighting, and any
proposal-specific analysis. Allowing a project to supply an arbitrary Babel
plugin or version would provide none of those contracts and could make editor
lowering differ from a future command-line transform.

Loading JavaScript configuration or modules from a workspace would also execute
project-controlled code inside language tooling. VS Code treats [workspace
dependencies as a Workspace Trust
boundary](https://code.visualstudio.com/api/extension-guides/workspace-trust).

## Decision

Projects select stable FTS feature identifiers and source-level semantic
options. They do not configure Babel package names, plugin versions, or
arbitrary module paths.

FTS owns a curated feature adapter for each supported feature. The adapter owns
its parser and transform implementations, compatible dependency versions,
source mappings, language-service capability policy, and highlighting metadata.
The editor and future command-line tooling must use the same adapter. Babel
plugins are implementation dependencies of FTS or of a first-party feature
adapter, following the frontend boundary established by [ADR
3](0003-use-babel-as-the-initial-proposal-frontend.md).

FTS does not merge workspace Babel configuration into its transforms or load
arbitrary workspace plugins. Built-in adapters are distributed with FTS
initially. They may later move to separately installed first-party feature
packages without exposing their underlying Babel dependencies as configuration.

A third-party adapter API requires a separate decision. It must define a
versioned FTS-specific contract, explicit opt-in, and Workspace Trust behavior
before external code can run in the language server.

## Consequences

Feature selection remains project-specific without making project configuration
depend on the current transformation backend. FTS can pin and test a compatible
parser, transform, mapping, and TypeScript integration as one unit. Editor and
command-line behavior can remain reproducible, and opening a project does not
implicitly load arbitrary Babel code from that workspace.

FTS must track proposal changes, dependency compatibility, and releases for
every supported adapter. Adding a feature requires an FTS adapter rather than
only adding a Babel plugin name. Bundling all built-in adapters may increase the
distribution size; first-party feature packages are the escape hatch when that
cost becomes material.
