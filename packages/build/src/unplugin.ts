import { lowerFutureTypeScript } from '@ftslang/core';
import remapping from '@jridgewell/remapping';
import { type Options, transform } from '@swc/core';
import { createUnplugin, type UnpluginFactory } from 'unplugin';

export const futureTypeScriptIdFilter = {
  exclude: /(?:^|[/\\])node_modules(?:[/\\])/,
  include: /\.fts(?:\?.*)?$/,
};

const typeScriptTransformOptions = {
  configFile: false,
  jsc: {
    parser: { syntax: 'typescript', tsx: false },
    target: 'esnext',
  },
  module: { type: 'es6' },
  sourceMaps: true,
  swcrc: false,
} satisfies Options;

const unpluginFactory: UnpluginFactory<undefined> = () => ({
  name: 'future-typescript',
  transform: {
    filter: {
      id: futureTypeScriptIdFilter,
    },
    async handler(source, id) {
      const fileName = id.replace(/\?.*$/, '');
      const lowered = lowerFutureTypeScript(source, fileName);
      const emitted = await transform(lowered.code, {
        ...typeScriptTransformOptions,
        filename: fileName,
      });
      if (!emitted.map) {
        throw new Error(`SWC did not produce a source map for ${fileName}`);
      }

      return {
        code: emitted.code,
        map: remapping([emitted.map, lowered.map], () => null),
      };
    },
  },
});

export const futureTypeScriptPlugin =
  /* #__PURE__ */ createUnplugin(unpluginFactory);
