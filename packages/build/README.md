# @ftslang/build

Experimental FTS build integration for Vite and Vitest. Requires Node.js 24.11
or later. This package is not yet published; development acceptance uses an
npm tarball.

```ts
import fts from '@ftslang/build/vite';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [fts()] });
```

Import `.fts` modules with explicit extensions from ordinary TypeScript. Use
the same Vite configuration for Vitest. Type checking is a separate operation
using `@ftslang/content-mapper` and the supported TypeScript compiler.

The mapper is a production dependency of this package. Vite is supplied by
the consumer; other build hosts are not currently supported.
