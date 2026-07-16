import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPassageTyping, matchReading } from '../lib/passage';
import { toRomaji } from '../lib/typing';

const PASSAGES = JSON.parse(
  readFileSync(new URL('../../public/passages/starter.json', import.meta.url), 'utf8'),
);

const sample = {
  lang: 'zh',
  segments: [
    { surface: '私', reading: 'わたし', pos: 'pronoun', trans: [0] },
    { surface: 'は', reading: '', pos: 'particle', trans: null },
    { surface: '。', reading: '', pos: 'punct', trans: null },
  ],
  translation: ['我'],
};

describe('buildPassageTyping', () => {
  it('assigns romaji spans and skips reading-less segments', () => {
    const model = buildPassageTyping(sample);
    expect(model.target).toBe('watashi');
    expect(model.typeable).toHaveLength(1);
    expect(model.segments[0]).toMatchObject({ start: 0, end: 7, romaji: 'watashi' });
    // Particle and punctuation carry no keystrokes — zero-width spans.
    expect(model.segments[1]).toMatchObject({ start: 7, end: 7, romaji: '' });
    expect(model.segments[2]).toMatchObject({ start: 7, end: 7, romaji: '' });
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

describe('starter passage data', () => {
  it.each(PASSAGES)('$id is internally consistent', (passage) => {
    expect(passage.segments.length).toBeGreaterThan(0);
    const tokenCount = passage.translation.length;

    for (const segment of passage.segments) {
      // Readings are hiragana that must romanize to typeable keystrokes.
      if (segment.reading) {
        expect(toRomaji(segment.reading)).toMatch(/^[a-z-]+$/);
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
