#!/usr/bin/env node

const { runFutureTypeScriptCheck } = require('../dist/check.cjs');

runFutureTypeScriptCheck().then((exitCode) => {
  process.exitCode = exitCode;
});
