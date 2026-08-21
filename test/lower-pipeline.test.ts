import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SourceMap } from "@volar/language-core";

import { lowerPipeline } from "../src/language/lower-pipeline.js";

const fixtureUrl = new URL("../examples/pipeline.fts", import.meta.url);

test("lowers Hack pipelines to type-checkable TypeScript", async () => {
  const source = await readFile(fixtureUrl, "utf8");
  const lowered = lowerPipeline(source, fixtureUrl.pathname);

  assert.doesNotMatch(lowered.code, /\|>/);
  assert.match(lowered.code, /format\(_ref\)/);
  assert.match(lowered.code, /Math\.round\(_ref2\)/);
});

test("maps hover symbols and generated topic references", async () => {
  const source = await readFile(fixtureUrl, "utf8");
  const lowered = lowerPipeline(source, fixtureUrl.pathname);
  const sourceMap = new SourceMap(lowered.mappings);

  const sourceResult = source.indexOf("result");
  const generatedResults = [
    ...sourceMap.toGeneratedLocation(
      sourceResult,
      (information) => !!information.semantic,
    ),
  ];
  assert.ok(
    generatedResults.some(([offset]) =>
      lowered.code.startsWith("result", offset),
    ),
  );

  const generatedTopic = lowered.code.lastIndexOf("_ref2");
  const sourceTopic = source.lastIndexOf("%");
  const generatedSemanticLocations = [
    ...sourceMap.toGeneratedLocation(
      sourceTopic,
      (information) => !!information.semantic,
    ),
  ];
  assert.deepEqual(generatedSemanticLocations, []);

  const sourceRanges = [
    ...sourceMap.toSourceRange(
      generatedTopic,
      generatedTopic + "_ref2".length,
      true,
      (information) => !!information.verification,
    ),
  ];
  assert.deepEqual(
    sourceRanges.map(([start, end]) => source.slice(start, end)),
    ["%"],
  );
});
