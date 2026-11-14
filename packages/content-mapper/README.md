# @ftslang/content-mapper

Experimental FTS lowering and a TypeScript content mapper. Requires Node.js
24.11 or later and the exact supported TypeScript version, `7.1.0-beta`.
This package is not yet published; development acceptance uses an npm tarball.

Register `.fts` explicitly in the consumer's `tsconfig.json`:

```json
{
  "compilerOptions": { "noEmit": true, "strict": true },
  "contentMappers": [
    { "package": "@ftslang/content-mapper", "extensions": [".fts"] }
  ],
  "include": ["src"]
}
```

Run the consumer's compiler with `tsc --runExternalCode`. JavaScript builds use
`@ftslang/build/vite`; mapper declaration emit is not a supported library workflow.
