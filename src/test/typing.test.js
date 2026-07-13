import { describe, expect, it } from 'vitest';
import { DICTIONARY } from '../data/dictionary';
import {
  getKanaPreview,
  getWordForms,
  isCorrectAnswer,
  toHiragana,
} from '../lib/typing';

const school = DICTIONARY.find((word) => word.term === '学校');

describe('Japanese typing utilities', () => {
  it('converts standard romaji input to hiragana', () => {
    expect(toHiragana('gakkou')).toBe('がっこう');
    expect(getKanaPreview('gakko')).toBe('がっこ');
  });

  it('produces all study forms', () => {
    expect(getWordForms(school)).toEqual({
      written: '学校',
      hiragana: 'がっこう',
      katakana: 'ガッコウ',
      romaji: 'gakkou',
    });
  });

  it('accepts romaji, kana, katakana, and the written form', () => {
    expect(isCorrectAnswer('gakkou', school)).toBe(true);
    expect(isCorrectAnswer('がっこう', school)).toBe(true);
    expect(isCorrectAnswer('ガッコウ', school)).toBe(true);
    expect(isCorrectAnswer('学校', school)).toBe(true);
  });

  it('rejects incomplete or unrelated answers', () => {
    expect(isCorrectAnswer('gakko', school)).toBe(false);
    expect(isCorrectAnswer('せんせい', school)).toBe(false);
  });
});
