import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPassageTyping, matchReading, typingKeys } from '../lib/passage';
import { getKanaPreview, toRomaji } from '../lib/typing';

const PASSAGES = JSON.parse(
  readFileSync(new URL('../../public/passages/starter.json', import.meta.url), 'utf8'),
);

const sample = {
  lang: 'zh',
  segments: [
    { surface: '私', reading: 'わたし', pos: 'pronoun', trans: [0] },
    { surface: 'は', reading: 'は', pos: 'particle', trans: null },
    { surface: '。', reading: '', pos: 'punct', trans: null },
    { surface: ' ', reading: '', pos: 'punct', trans: null },
  ],
  translation: ['我'],
};

describe('buildPassageTyping', () => {
  it('types only segments with a reading and skips the rest', () => {
    const model = buildPassageTyping(sample);
    // Punctuation and spaces carry no keystrokes — the cursor jumps over them.
    expect(model.target).toBe('watashiha');
    expect(model.typeable).toHaveLength(2);
    expect(model.segments[0]).toMatchObject({ kind: 'kana', romaji: 'watashi', start: 0, end: 7 });
    expect(model.segments[1]).toMatchObject({ kind: 'kana', romaji: 'ha', start: 7, end: 9 });
    expect(model.segments[2]).toMatchObject({ kind: 'skip', romaji: '', start: 9, end: 9 });
    expect(model.segments[3]).toMatchObject({ kind: 'skip', romaji: '' });
  });

  it('leaves no punctuation in the typing path of a real passage', () => {
    for (const passage of PASSAGES) {
      const { typeable } = buildPassageTyping(passage);
      expect(typeable.every((segment) => segment.reading)).toBe(true);
      expect(typeable.some((segment) => segment.pos === 'punct')).toBe(false);
    }
  });
});

describe('matchReading', () => {
  it('reports per-key progress while a segment is being typed', () => {
    // わた entered, し pending → 4 canonical romaji keys (w a t a) are done.
    expect(matchReading('wata', 'わたし')).toMatchObject({
      matched: 4,
      wrong: false,
      complete: false,
    });
  });

  it('holds mid-mora on a trailing consonant without flagging it wrong', () => {
    // "watas" → わたs: the s hasn't formed a kana yet, so cursor stays after わた.
    expect(matchReading('watas', 'わたし')).toMatchObject({
      matched: 4,
      wrong: false,
      complete: false,
    });
  });

  it('accepts every standard IME romaji spelling of a mora', () => {
    // Hepburn and Kunrei/wāpuro spellings both complete the same reading.
    expect(matchReading('watashi', 'わたし').complete).toBe(true);
    expect(matchReading('watasi', 'わたし').complete).toBe(true);
    expect(matchReading('tsu', 'つ').complete).toBe(true);
    expect(matchReading('tu', 'つ').complete).toBe(true);
    expect(matchReading('fu', 'ふ').complete).toBe(true);
    expect(matchReading('hu', 'ふ').complete).toBe(true);
    expect(matchReading('sha', 'しゃ').complete).toBe(true);
    expect(matchReading('sya', 'しゃ').complete).toBe(true);
  });

  it('honors particle input conventions (は→ha, を→wo, へ→he)', () => {
    expect(matchReading('ha', 'は').complete).toBe(true);
    expect(matchReading('wo', 'を').complete).toBe(true);
    expect(matchReading('he', 'へ').complete).toBe(true);
    // The spoken reading (wa/o/e) is a different kana → not accepted, as in an IME.
    expect(matchReading('wa', 'は')).toMatchObject({ complete: false, wrong: true });
  });

  it('flags a wrong mora as soon as it resolves', () => {
    expect(matchReading('ki', 'わたし')).toMatchObject({ matched: 0, wrong: true });
  });
});

describe('typingKeys', () => {
  it('emits keys that type back to the same kana', () => {
    // WanaKana romanises ふぉ as "fuo", but typing that gives ふお.
    expect(toRomaji('ふぉ')).toBe('fuo');
    expect(typingKeys('ゆうふぉにあむ')).toBe('yuufoniamu');
    expect(getKanaPreview(typingKeys('ゆうふぉにあむ'))).toBe('ゆうふぉにあむ');
  });

  it('doubles a lone ん, which never commits as a bare "n"', () => {
    expect(typingKeys('あさごはん')).toBe('asagohann');
    expect(typingKeys('おんなのこ')).toBe('onnnanoko');
    expect(getKanaPreview(typingKeys('あさごはん'))).toBe('あさごはん');
    expect(getKanaPreview(typingKeys('おんなのこ'))).toBe('おんなのこ');
  });

  it('leaves ordinary morae on their canonical spelling', () => {
    expect(typingKeys('わたし')).toBe('watashi');
    expect(typingKeys('がっこう')).toBe('gakkou');
    expect(typingKeys('ぎゅうにゅう')).toBe('gyuunyuu');
  });
});

describe('starter passage data', () => {
  it.each(PASSAGES)('$id is internally consistent', (passage) => {
    expect(passage.segments.length).toBeGreaterThan(0);
    const tokenCount = passage.translation.length;

    for (const segment of passage.segments) {
      // Every reading must be typeable: the keys we show the learner have to
      // convert back to exactly this reading, or the passage can't be finished.
      if (segment.reading) {
        const keys = typingKeys(segment.reading);
        expect(keys).toMatch(/^[a-z-]+$/);
        expect(getKanaPreview(keys)).toBe(segment.reading);
      }
      // Every alignment index points at a real translation token.
      if (segment.trans != null) {
        for (const index of segment.trans) {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(tokenCount);
        }
      }
    }

    const model = buildPassageTyping(passage);
    expect(model.typeable.length).toBeGreaterThan(0);
    expect(model.target.length).toBeGreaterThan(0);
  });
});
