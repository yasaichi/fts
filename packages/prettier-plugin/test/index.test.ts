import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

describe('FTS Prettier plugin', () => {
  it('formats .fts files with the inferred parser', async () => {
    const formatted = await format('const result={ id:1}|>format(%)\n', {
      filepath: 'example.fts',
      plugins: [plugin],
    });

    expect(formatted).toBe('const result = { id: 1 } |> format(%);\n');
  });
});
