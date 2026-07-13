import { getWordsByLevel } from '../data/dictionary';

export const shuffleWords = (words, random = Math.random) => {
  const copy = [...words];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export const createBatch = ({ level, batchSize, shuffle = true }) => {
  const words = getWordsByLevel(level);
  const ordered = shuffle ? shuffleWords(words) : words;
  return ordered.slice(0, Math.min(Math.max(Number(batchSize) || 20, 1), words.length));
};

export const createSession = (settings, mode = 'recite', batchOverride) => ({
  mode,
  phase: 'active',
  batchIds: (batchOverride || createBatch(settings)).map((word) => word.id),
  index: 0,
  results: [],
  startedAt: new Date().toISOString(),
});

export const getSessionScore = (results) => {
  if (!results.length) return 0;
  const correct = results.filter((result) => result.correct).length;
  return Math.round((correct / results.length) * 100);
};
