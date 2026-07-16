import { describe, expect, it } from 'vitest';
import { createBatch, getSessionScore, shuffleWords } from '../lib/session';

const makeWords = (level, count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${level.toLowerCase()}-${index}`,
    level,
    term: `词${index}`,
    reading: `よみ${index}`,
  }));

const WORDS = [...makeWords('N5', 30), ...makeWords('N1', 3)];

describe('study sessions', () => {
  it('respects the requested batch size and level', () => {
    const batch = createBatch({ level: 'N5', batchSize: 20, shuffle: false }, WORDS);
    expect(batch).toHaveLength(20);
    expect(batch.every((word) => word.level === 'N5')).toBe(true);
  });

  it('caps a batch at the available words for the level', () => {
    expect(createBatch({ level: 'N1', batchSize: 50 }, WORDS)).toHaveLength(3);
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
