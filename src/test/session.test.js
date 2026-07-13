import { describe, expect, it } from 'vitest';
import { createBatch, getSessionScore, shuffleWords } from '../lib/session';

describe('study sessions', () => {
  it('respects the requested batch size and level', () => {
    const batch = createBatch({ level: 'N5', batchSize: 20, shuffle: false });
    expect(batch).toHaveLength(20);
    expect(batch.every((word) => word.level === 'N5')).toBe(true);
  });

  it('caps a batch at the available dictionary size', () => {
    expect(createBatch({ level: 'N1', batchSize: 50 })).toHaveLength(25);
  });

  it('supports deterministic shuffling and score calculation', () => {
    expect(shuffleWords([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
    expect(
      getSessionScore([
        { correct: true },
        { correct: false },
        { correct: true },
      ]),
    ).toBe(67);
  });
});
