import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

console.log(
  JSON.stringify({
    build: fileURLToPath(import.meta.resolve('@ftslang/build/vite')),
    compiler: realpathSync('node_modules/.bin/tsc'),
    formatter: fileURLToPath(import.meta.resolve('@ftslang/prettier-plugin')),
    mapper: fileURLToPath(
      import.meta.resolve('@ftslang/content-mapper/mapper'),
    ),
  }),
);
