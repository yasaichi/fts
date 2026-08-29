import { format, getFileInfo } from 'prettier';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

describe('FTS Prettier plugin', () => {
  it('selects the FTS parser for .fts files', async () => {
    const information = await getFileInfo('/workspace/example.fts', {
      plugins: [plugin],
    });

    expect(information.inferredParser).toBe('fts');
  });

  it('formats Future TypeScript with its file parser', async () => {
    const source = 'const result={ id:1}|>format(%)\n';

    const formatted = await format(source, {
      parser: 'fts',
      plugins: [plugin],
      singleQuote: true,
    });

    expect(formatted).toBe('const result = { id: 1 } |> format(%);\n');
  });
});
