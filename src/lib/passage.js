import { getKanaPreview, toRomaji } from './typing';

// Plain-keyboard stand-ins for Japanese punctuation, so a passage can be typed
// without installing a Japanese IME: the learner presses an ASCII key and the
// cursor accepts it for the Japanese mark. WanaKana already maps most of these,
// but not the 「」『』 quote brackets, so we keep one explicit table for all of
// them. The first key in each list is the one shown in the keystroke guide.
export const PUNCT_KEYS = {
  '。': ['.'],
  '、': [','],
  '！': ['!'],
  '？': ['?'],
  '（': ['(', '['],
  '）': [')', ']'],
  '「': ['[', '"'],
  '」': [']', '"'],
  '『': ['"', '['],
  '』': ['"', ']'],
  '・': ['/'],
  '〜': ['~'],
};

// Build the type-along model for a reading passage. Each segment gets a `kind`
// ('kana' | 'punct' | 'skip'), the keys the learner types, and its [start, end)
// span in the whole-passage keystroke stream. Kana segments type romaji;
// punctuation types its ASCII stand-in; spaces and paragraph breaks are skipped.
export const buildPassageTyping = (passage) => {
  let cursor = 0;
  const segments = passage.segments.map((segment, index) => {
    let kind = 'skip';
    let romaji = '';
    if (segment.reading) {
      kind = 'kana';
      romaji = toRomaji(segment.reading);
    } else if (PUNCT_KEYS[segment.surface]) {
      kind = 'punct';
      romaji = PUNCT_KEYS[segment.surface][0]; // primary key, shown in the guide
    }
    const start = cursor;
    cursor += romaji.length;
    return { ...segment, index, kind, romaji, start, end: cursor };
  });
  return {
    segments,
    typeable: segments.filter((segment) => segment.kind !== 'skip'),
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

// Match input for one built segment, dispatching on kind. Punctuation accepts
// its ASCII stand-in (or the Japanese mark itself); kana goes through the
// IME-style matcher above.
export const matchSegment = (typed, segment) => {
  if (segment.kind === 'punct') {
    const keys = PUNCT_KEYS[segment.surface] ?? [];
    const entered = (typed || '').trim();
    if (!entered) return { matched: 0, wrong: false, complete: false };
    const ok = keys.includes(entered) || entered === segment.surface;
    return { matched: ok ? 1 : 0, wrong: !ok, complete: ok };
  }
  return matchReading(typed, segment.reading);
};
