import { getKanaPreview, splitMorae, toRomaji } from './typing';

const SMALL_KANA = new Set('ゃゅょぁぃぅぇぉゎ');

// WanaKana's toRomaji is a *transliteration*, not IME input, so it can't be used
// to tell a learner which keys to press: it renders ふぉ as "fuo" (typing that
// gives ふお) and ん as a bare "n" (which an IME leaves pending, never
// committing). Derive each mora's keys instead and verify they type back to the
// same kana, falling back through the standard IME spellings.
const moraKeys = (mora) => {
  if (mora === 'ん') return 'nn'; // a lone "n" never commits on its own
  const direct = toRomaji(mora);
  if (getKanaPreview(direct) === mora) return direct;
  if (mora.length >= 2 && SMALL_KANA.has(mora.slice(-1))) {
    const base = toRomaji(mora.slice(0, -1));
    const small = toRomaji(mora.slice(-1));
    // ふ+ぉ → "f"+"o"; else the explicit small-kana form, て+ぃ → "te"+"x"+"i".
    for (const candidate of [base.slice(0, -1) + small, `${base}x${small}`]) {
      if (getKanaPreview(candidate) === mora) return candidate;
    }
  }
  return direct;
};

// The keys a learner actually presses to produce `kana`. Round-trips through the
// IME: getKanaPreview(typingKeys(k)) === k.
export const typingKeys = (kana) => (kana ? splitMorae(kana).map(moraKeys).join('') : '');

// Build the type-along model for a reading passage. Each segment gets a `kind`
// ('kana' | 'skip'), the keys the learner types, and its [start, end) span in
// the whole-passage keystroke stream. Only segments with a reading are typed;
// punctuation, spaces, and paragraph breaks carry no keystrokes and the cursor
// skips straight over them — pressing 。 or 『 teaches nothing.
export const buildPassageTyping = (passage) => {
  let cursor = 0;
  const segments = passage.segments.map((segment, index) => {
    const kind = segment.reading ? 'kana' : 'skip';
    const romaji = segment.reading ? typingKeys(segment.reading) : '';
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
    matched: typingKeys(reading.slice(0, common)).length,
    wrong: !onTrack,
    complete: onTrack && settled === reading && kana === settled,
  };
};
