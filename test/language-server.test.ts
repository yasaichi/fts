import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node";
import { URI } from "vscode-uri";

interface Diagnostic {
  message: string;
  range: Range;
}

interface Hover {
  contents: string | { value: string } | Array<string | { value: string }>;
}

interface Position {
  character: number;
  line: number;
}

interface Range {
  end: Position;
  start: Position;
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixturePath = path.join(repositoryRoot, "examples", "pipeline.fts");
const fixtureUri = URI.file(fixturePath).toString();
const workspaceUri = URI.file(path.dirname(fixturePath)).toString();

test("returns mapped TypeScript diagnostics and hover through LSP", async (t) => {
  const child = spawn(
    process.execPath,
    ["--import=tsx", "src/server.ts", "--stdio"],
    {
      cwd: repositoryRoot,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  const serverErrors: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => serverErrors.push(chunk.toString()));
  connection.onError((error) => serverErrors.push(String(error)));
  connection.onRequest("client/registerCapability", () => null);
  connection.onRequest("workspace/configuration", () => []);
  connection.onRequest("workspace/workspaceFolders", () => [
    { name: "examples", uri: workspaceUri },
  ]);
  connection.listen();

  t.after(async () => {
    await stopServer(connection, child);
    assert.equal(serverErrors.join(""), "");
  });

  await connection.sendRequest("initialize", {
    capabilities: {
      textDocument: {
        hover: { contentFormat: ["markdown", "plaintext"] },
        publishDiagnostics: { relatedInformation: true },
      },
      workspace: {
        configuration: false,
        didChangeWatchedFiles: { dynamicRegistration: false },
        workspaceFolders: true,
      },
    },
    clientInfo: { name: "future-typescript-test", version: "0.0.1" },
    processId: process.pid,
    rootUri: workspaceUri,
    workspaceFolders: [{ name: "examples", uri: workspaceUri }],
  });
  connection.sendNotification("initialized", {});

  const source = await readFile(fixturePath, "utf8");
  const diagnosticsPromise = waitForDiagnostics(connection, fixtureUri);
  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      languageId: "future-typescript",
      text: source,
      uri: fixtureUri,
      version: 1,
    },
  });

  const hover = await connection.sendRequest<Hover | null>("textDocument/hover", {
    position: { character: 8, line: 4 },
    textDocument: { uri: fixtureUri },
  });
  assert.ok(hover);
  assert.match(hoverText(hover), /result: string/);

  const diagnostics = await diagnosticsPromise;
  assert.equal(diagnostics.length, 1);
  const typeError = diagnostics.find((diagnostic) =>
    diagnostic.message.includes(
      "Argument of type '{ id: number; }' is not assignable to parameter of type 'number'",
    ),
  );
  assert.ok(typeError);
  assert.equal(typeError.range.start.line, 11);
  assert.equal(textInRange(source, typeError.range), "%");

  for (const character of [16, 17]) {
    const topicHover = await connection.sendRequest<Hover | null>(
      "textDocument/hover",
      {
        position: { character, line: 11 },
        textDocument: { uri: fixtureUri },
      },
    );
    if (topicHover) {
      assert.doesNotMatch(hoverText(topicHover), /_ref2/);
    }
  }
});

function hoverText(hover: Hover): string {
  const contents = Array.isArray(hover.contents)
    ? hover.contents
    : [hover.contents];
  return contents
    .map((content) => (typeof content === "string" ? content : content.value))
    .join("\n");
}

async function stopServer(
  connection: MessageConnection,
  child: ChildProcessWithoutNullStreams,
): Promise<void> {
  try {
    await connection.sendRequest("shutdown");
    connection.sendNotification("exit");
  } finally {
    connection.dispose();
    if (!child.killed) {
      child.kill();
    }
  }
}

function textInRange(source: string, range: Range): string {
  const lines = source.split("\n");
  assert.equal(range.start.line, range.end.line);
  return lines[range.start.line]!.slice(
    range.start.character,
    range.end.character,
  );
}

function waitForDiagnostics(
  connection: MessageConnection,
  uri: string,
): Promise<Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for diagnostics")),
      10_000,
    );
    const disposable = connection.onNotification(
      "textDocument/publishDiagnostics",
      (params: { diagnostics: Diagnostic[]; uri: string }) => {
        if (params.uri === uri && params.diagnostics.length > 0) {
          clearTimeout(timeout);
          disposable.dispose();
          resolve(params.diagnostics);
        }
      },
    );
  });
}
