import * as wanakana from 'wanakana';

const stripMarks = (value) =>
  value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s。、，,.!?！？・]/g, '')
    .replace(/[āáàâä]/g, 'a')
    .replace(/[īíìîï]/g, 'i')
    .replace(/[ūúùûü]/g, 'u')
    .replace(/[ēéèêë]/g, 'e')
    .replace(/[ōóòôö]/g, 'o');

export const toHiragana = (value) =>
  wanakana.toHiragana(stripMarks(value), { IMEMode: false });

export const toKatakana = (reading) => wanakana.toKatakana(reading);

export const toRomaji = (reading) =>
  wanakana.toRomaji(reading).replace(/'/g, '');

export const getKanaPreview = (value) => {
  if (!value.trim()) return '';
  return wanakana.toHiragana(value.normalize('NFKC').toLowerCase(), {
    IMEMode: true,
  });
};

export const getWordForms = (word) => ({
  written: word.term,
  hiragana: word.reading,
  katakana: toKatakana(word.reading),
  romaji: toRomaji(word.reading),
});

export const isCorrectAnswer = (input, word) => {
  const cleaned = stripMarks(input);
  if (!cleaned) return false;

  const forms = getWordForms(word);
  const acceptedLiteral = [forms.written, forms.hiragana, forms.katakana].map(
    stripMarks,
  );

  return (
    acceptedLiteral.includes(cleaned) ||
    toHiragana(cleaned) === stripMarks(forms.hiragana) ||
    cleaned === stripMarks(forms.romaji)
  );
};

export const classifyScript = (term) => {
  if (wanakana.isKatakana(term)) return '片假名';
  if (wanakana.isHiragana(term)) return '平假名';
  if (wanakana.isJapanese(term)) return '汉字 / 假名';
  return '外来语';
};

export const splitKeystrokes = (reading) => toRomaji(reading).split('');

// Furigana-style alignment: break a word into written segments whose readings
// concatenate back to word.reading. Kana in the term anchor to the same kana in
// the reading; each kanji run absorbs the reading up to the next anchor. Returns
// a single whole-word segment when the term is one unit or the pieces can't be
// aligned confidently (e.g. a multi-kanji compound with no kana anchor between
// its characters), so we never invent a wrong furigana split.
export const segmentWord = (word) => {
  const whole = [{ label: word.term, reading: word.reading }];
  const { reading } = word;

  const tokens = [];
  for (const character of word.term) {
    const kind = wanakana.isKana(character) ? 'kana' : 'kanji';
    const previous = tokens[tokens.length - 1];
    if (previous && previous.kind === kind) previous.text += character;
    else tokens.push({ kind, text: character });
  }
  if (tokens.length <= 1) return whole;

  const segments = [];
  let cursor = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind === 'kana') {
      const kana = toHiragana(token.text);
      if (!reading.startsWith(kana, cursor)) return whole;
      segments.push({ label: token.text, reading: reading.slice(cursor, cursor + kana.length) });
      cursor += kana.length;
    } else {
      const next = tokens[index + 1];
      if (!next) {
        segments.push({ label: token.text, reading: reading.slice(cursor) });
        cursor = reading.length;
      } else {
        const anchor = reading.indexOf(toHiragana(next.text), cursor);
        if (anchor < 0) return whole;
        segments.push({ label: token.text, reading: reading.slice(cursor, anchor) });
        cursor = anchor;
      }
    }
  }
  if (cursor !== reading.length || segments.some((segment) => !segment.reading)) {
    return whole;
  }
  return segments;
};

const SMALL_KANA = new Set('ゃゅょぁぃぅぇぉゎ');

const kanjiCount = (label) =>
  [...label].filter((character) => !wanakana.isKana(character)).length;

// Break a reading into mora-sized chunks: a small kana (ゃゅょ…) joins the kana
// before it and a sokuon (っ) joins the kana after it, so each chunk is one
// typeable syllable.
export const splitMorae = (reading) => {
  const morae = [];
  for (const character of reading) {
    const previous = morae[morae.length - 1];
    if (morae.length && (SMALL_KANA.has(character) || previous === 'っ')) {
      morae[morae.length - 1] += character;
    } else {
      morae.push(character);
    }
  }
  return morae;
};

// Map word segments onto ranges of the romaji keystroke sequence for the
// keystroke guide. An aligned kanji keeps one labelled group (見, 食…). A
// multi-kanji run that couldn't be aligned per character (昨日 → きのう, whose
// reading doesn't decompose into 昨/日) is split by mora with kana labels, so it
// still partitions instead of rendering as one undivided run. Returns null when
// there is nothing to separate or the romaji boundaries don't line up.
export const keystrokeGroups = (word) => {
  const segments = segmentWord(word);
  const groups = [];
  let kanaEnd = 0;

  const push = (label, kanaLength) => {
    const start = toRomaji(word.reading.slice(0, kanaEnd)).length;
    kanaEnd += kanaLength;
    const end = toRomaji(word.reading.slice(0, kanaEnd)).length;
    groups.push({ label, start, end });
  };

  for (const segment of segments) {
    if (kanjiCount(segment.label) >= 2 && segment.reading.length >= 2) {
      splitMorae(segment.reading).forEach((mora) => push(mora, mora.length));
    } else {
      push(segment.label, segment.reading.length);
    }
  }

  if (groups.length <= 1) return null;
  if (groups[groups.length - 1].end !== toRomaji(word.reading).length) return null;
  return groups;
};
