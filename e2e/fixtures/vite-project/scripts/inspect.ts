import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const manifestPath = require.resolve('@ftslang/content-mapper/package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

console.log(
  JSON.stringify({
    build: fileURLToPath(import.meta.resolve('@ftslang/build/vite')),
    compiler: realpathSync('node_modules/.bin/tsc'),
    formatter: fileURLToPath(import.meta.resolve('@ftslang/prettier-plugin')),
    mapper: resolve(
      dirname(manifestPath),
      manifest.typescript.contentMapper.exec[1],
    ),
  }),
);
