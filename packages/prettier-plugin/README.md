# @ftslang/prettier-plugin

Experimental `.fts` language registration for Prettier's built-in `babel-ts`
parser. Requires Node.js 24.11 or later and Prettier `3.9.10`.
This package is not yet published; development acceptance uses an npm tarball.

```sh
prettier --plugin @ftslang/prettier-plugin --check "src/**/*.fts"
```

Formatting preserves proposal syntax. This plugin does not perform lowering
or type checking.
