import { describe as context, describe, expect, it } from 'vitest';
import { answer } from '../src/pipeline.fts';

describe('FTS module import', () => {
  context('when the fixture Vite config loads the module', () => {
    it('exports the pipeline result', () => {
      expect(answer).toBe(42);
    });
  });
});
