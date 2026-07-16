// JLPT level metadata (UI constants). The word data itself is fetched at runtime
// from public/dictionaries/ — see src/lib/dictionaryLoader.js and scripts/
// build-dictionaries.mjs.

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export const LEVEL_LABELS = {
  N5: '入门',
  N4: '基础',
  N3: '进阶',
  N2: '中高级',
  N1: '高级',
};

export const getWordsByLevel = (words, level) =>
  words.filter((word) => word.level === level);
