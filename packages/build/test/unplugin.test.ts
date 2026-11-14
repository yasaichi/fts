import { describe as context, describe, expect, it } from 'vitest';
import { ftsIdFilter, ftsPlugin } from '../src/unplugin.js';

describe('FTS transform hook', () => {
  context('when the module ID carries a query', () => {
    it('maps the emitted JavaScript to the query-free source filename', async () => {
      const plugin = ftsPlugin.raw(undefined, { framework: 'vite' });
      if (Array.isArray(plugin) || typeof plugin.transform !== 'object') {
        throw new Error('Expected one FTS transform hook');
      }

      // The hook does not use the build context; observe its returned map.
      const result = await Reflect.apply(plugin.transform.handler, {}, [
        'export const answer: number = 21 |> % * 2;',
        '/project/src/pipeline.fts?fts-test',
      ]);

      expect(result.map).toMatchObject({
        sources: ['/project/src/pipeline.fts'],
      });
    });
  });
});

describe('ftsIdFilter', () => {
  describe('include', () => {
    context.each([
      {
        condition: 'the path ends in .fts',
        id: '/project/src/index.fts',
        included: true,
      },
      {
        condition: 'an .fts path carries a query',
        id: '/project/src/index.fts?raw',
        included: true,
      },
      {
        condition: 'the path has an unrelated extension',
        id: '/project/src/index.ts',
        included: false,
      },
      {
        condition: 'the extension has extra characters after .fts',
        id: '/project/src/index.ftsx',
        included: false,
      },
      {
        condition: 'only the query ends in .fts',
        id: '/project/src/index.ts?source=index.fts',
        included: false,
      },
    ])('when $condition', ({ id, included }) => {
      it(`includes the module: ${included}`, () => {
        expect(ftsIdFilter.include.test(id)).toBe(included);
      });
    });
  });

  describe('exclude', () => {
    context.each([
      {
        condition: 'the path is in node_modules',
        id: '/project/node_modules/dependency/index.fts',
        excluded: true,
      },
      {
        condition: 'node_modules is the first path segment',
        id: 'node_modules/dependency/index.fts',
        excluded: true,
      },
      {
        condition: 'the path uses Windows separators',
        id: 'C:\\project\\node_modules\\dependency\\index.fts',
        excluded: true,
      },
      {
        condition: 'the module is in project source',
        id: '/project/src/index.fts',
        excluded: false,
      },
      {
        condition: 'only the query contains node_modules',
        id: '/project/src/index.fts?source=/node_modules/dependency',
        excluded: false,
      },
      {
        condition: 'the directory has a similar prefix',
        id: '/project/my_node_modules/index.fts',
        excluded: false,
      },
      {
        condition: 'the directory has a similar suffix',
        id: '/project/node_modules_copy/index.fts',
        excluded: false,
      },
    ])('when $condition', ({ id, excluded }) => {
      it(`excludes the module: ${excluded}`, () => {
        expect(ftsIdFilter.exclude.test(id)).toBe(excluded);
      });
    });
  });
});
