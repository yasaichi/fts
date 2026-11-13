import { format } from 'prettier';
import { describe as context, describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

describe('FTS Prettier plugin', () => {
  context('when the filepath has the .fts extension', () => {
    it('formats the pipeline without an explicit parser', async () => {
      const formatted = await format('const result={ id:1}|>format(%)\n', {
        filepath: 'example.fts',
        plugins: [plugin],
      });

      expect(formatted).toBe('const result = { id: 1 } |> format(%);\n');
    });
  });
});
