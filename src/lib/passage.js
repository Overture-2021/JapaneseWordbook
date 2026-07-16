import { getKanaPreview, toRomaji } from './typing';

// Build the type-along model for a reading passage. Each segment is annotated
// with the romaji the learner types for it and its [start, end) span within the
// whole-passage romaji target. Punctuation and any segment with an empty reading
// contribute no keystrokes — the cursor skips them.
export const buildPassageTyping = (passage) => {
  let cursor = 0;
  const segments = passage.segments.map((segment, index) => {
    const romaji = segment.reading ? toRomaji(segment.reading) : '';
    const start = cursor;
    cursor += romaji.length;
    return { ...segment, index, romaji, start, end: cursor };
  });
  return {
    segments,
    typeable: segments.filter((segment) => segment.romaji),
    target: segments.map((segment) => segment.romaji).join(''),
  };
};

// Match typed input against a segment's kana `reading` the way a Japanese IME
// does. Rather than compare raw romaji to one canonical spelling, we convert the
// input to kana via WanaKana's IME mode and compare kana — so every standard
// romaji spelling of a mora is accepted (shi/si, tsu/tu, fu/hu, ji/zi, chi/ti,
// sha/sya, nn, wo…), matching real Japanese input-method conventions.
//
// A trailing consonant that hasn't formed a kana yet (e.g. "wata" + "s" → わたs)
// stays mid-mora: it neither advances the cursor nor counts as wrong until it
// resolves. `matched` is the number of canonical romaji keys spanned by the kana
// entered correctly so far, so the keystroke guide still colours per key.
export const matchReading = (typed, reading) => {
  const kana = getKanaPreview(typed); // toHiragana(input, { IMEMode: true }) or ''
  const settled = kana.replace(/[a-z]+$/, ''); // fully-formed kana; drop the mid-mora tail
  const onTrack = reading.startsWith(settled);

  // Longest kana prefix typed correctly → how many canonical romaji keys are done.
  let common = 0;
  while (
    common < settled.length &&
    common < reading.length &&
    settled[common] === reading[common]
  ) {
    common += 1;
  }

  return {
    kana,
    matched: toRomaji(reading.slice(0, common)).length,
    wrong: !onTrack,
    complete: onTrack && settled === reading && kana === settled,
  };
};
