import { describe, expect, it } from 'vitest';
import { DICTIONARY } from '../data/dictionary';
import {
  getKanaPreview,
  getWordForms,
  isCorrectAnswer,
  keystrokeGroups,
  segmentWord,
  toHiragana,
} from '../lib/typing';

const school = DICTIONARY.find((word) => word.term === '学校');
const byTerm = (term) => DICTIONARY.find((word) => word.term === term);

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

describe('kanji-aware segmentation', () => {
  it('splits okurigana words into kanji stem + kana tail', () => {
    expect(segmentWord(byTerm('見る'))).toEqual([
      { label: '見', reading: 'み' },
      { label: 'る', reading: 'る' },
    ]);
    expect(segmentWord(byTerm('食べる'))).toEqual([
      { label: '食', reading: 'た' },
      { label: 'べる', reading: 'べる' },
    ]);
  });

  it('aligns every kanji when kana anchors separate them', () => {
    expect(segmentWord(byTerm('間に合う'))).toEqual([
      { label: '間', reading: 'ま' },
      { label: 'に', reading: 'に' },
      { label: '合', reading: 'あ' },
      { label: 'う', reading: 'う' },
    ]);
  });

  it('keeps unsplittable compounds and single units whole', () => {
    expect(segmentWord(byTerm('学校'))).toEqual([
      { label: '学校', reading: 'がっこう' },
    ]);
    expect(segmentWord(byTerm('ありがとう'))).toEqual([
      { label: 'ありがとう', reading: 'ありがとう' },
    ]);
  });

  it('maps segments onto romaji keystroke ranges, null when nothing to split', () => {
    expect(keystrokeGroups(byTerm('見る'))).toEqual([
      { label: '見', start: 0, end: 2 },
      { label: 'る', start: 2, end: 4 },
    ]);
    expect(keystrokeGroups(byTerm('大きい'))).toEqual([
      { label: '大', start: 0, end: 2 },
      { label: 'きい', start: 2, end: 5 },
    ]);
    expect(keystrokeGroups(byTerm('学校'))).toBeNull();
  });
});
