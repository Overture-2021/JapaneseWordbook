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
