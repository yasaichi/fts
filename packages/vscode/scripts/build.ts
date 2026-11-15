import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BuildOptions, build } from 'esbuild';

const directory = fileURLToPath(new URL('../', import.meta.url));
const options = {
  absWorkingDir: directory,
  bundle: true,
  metafile: true,
  platform: 'node',
  sourcemap: true,
  target: 'node24',
} satisfies BuildOptions;

const extension = await build({
  ...options,
  entryPoints: ['src/extension.ts'],
  external: ['vscode'],
  format: 'cjs',
  outfile: 'dist/extension.cjs',
});
const mapper = await build({
  ...options,
  // The npm mapper keeps normal TypeScript imports. Only the editor bundle
  // redirects them through the selected SDK, without copying compiler internals.
  entryPoints: ['../content-mapper/src/mapper.ts'],
  format: 'esm',
  outfile: 'dist/mapper.mjs',
  banner: {
    js: 'import { createRequire as __ftsCreateRequire } from "node:module"; const require = __ftsCreateRequire(import.meta.url);',
  },
  plugins: [
    {
      name: 'selected-typescript-sdk',
      setup(builder) {
        builder.onResolve(
          { filter: /^typescript\/(ast(?:\/.*)?|sync)$/ },
          ({ path }) => ({ namespace: 'selected-sdk', path }),
        );
        builder.onLoad(
          { filter: /.*/, namespace: 'selected-sdk' },
          async ({ path }) => ({
            contents: `import { loader } from ${JSON.stringify(join(directory, 'src/sdk-loader.ts'))};\nexport const { ${Object.keys(await import(path)).join(', ')} } = await loader.importModule(${JSON.stringify(path)});`,
            resolveDir: directory,
          }),
        );
      },
    },
  ],
});

const packages = new Set<string>();
for (const input of [
  ...Object.keys(extension.metafile.inputs),
  ...Object.keys(mapper.metafile.inputs),
]) {
  if (!input.includes('node_modules/')) continue;
  let parent = dirname(resolve(directory, input));
  while (!existsSync(join(parent, 'package.json'))) parent = dirname(parent);
  packages.add(parent);
}
const notices = [...packages].toSorted().map((packageDirectory) => {
  const manifest = JSON.parse(
    readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
  );
  const licenses = readdirSync(packageDirectory).filter((name) =>
    /^(licen[cs]e|notice)(\.|$)/i.test(name),
  );
  return [
    `${manifest.name}@${manifest.version} (${manifest.license ?? 'see package license'})`,
    ...licenses.map((name) =>
      readFileSync(join(packageDirectory, name), 'utf8'),
    ),
  ].join('\n\n');
});
writeFileSync(
  join(directory, 'dist/THIRD_PARTY_NOTICES.txt'),
  notices.join('\n\n---\n\n'),
);
writeFileSync(
  join(directory, 'dist/mapper.meta.json'),
  JSON.stringify(mapper.metafile, null, 2),
);
