import { build } from "esbuild";

const sharedOptions = {
  bundle: true,
  logLevel: "info",
  packages: "external",
  platform: "node",
  sourcemap: true,
  target: "node24",
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: ["src/extension.ts"],
    external: ["vscode"],
    format: "cjs",
    outfile: "dist/extension.cjs",
  }),
  build({
    ...sharedOptions,
    entryPoints: ["src/server.ts"],
    format: "cjs",
    outfile: "dist/server.cjs",
  }),
]);
