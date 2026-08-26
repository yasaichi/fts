import { expect, it } from 'vitest';
import { answer } from '../src/pipeline.fts';

it('executes the pipeline', () => {
  expect(answer).toBe(42);
});
