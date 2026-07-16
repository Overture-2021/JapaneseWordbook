// Builds the fetched dictionary assets in public/dictionaries/ from open data.
//
// Sources (see ATTRIBUTIONS.md):
//   - open-anki-jlpt-decks  → JLPT level, kana reading, English gloss (the spine)
//   - kaikki.org zhwiktionary 日語 → Chinese gloss + part of speech, where available
//
// The JLPT deck is authoritative for grading/reading/English and covers 100% of
// the headwords. Chinese glosses come from the Chinese Wiktionary extract and
// only cover part of the list, so `meaning` is Chinese when we have it and falls
// back to English otherwise. Traditional glosses are converted to Simplified.
//
// Run: node scripts/build-dictionaries.mjs
// Sources are cached under scripts/.cache/ (git-ignored) and downloaded on first run.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', '.cache');
const OUT = join(ROOT, 'public', 'dictionaries');

const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];
const LEVEL_LABELS = { N5: '入门', N4: '基础', N3: '进阶', N2: '中高级', N1: '高级' };

const DECK_URL = (lv) =>
  `https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src/${lv}.csv`;
const KAIKKI_URL =
  'https://kaikki.org/zhwiktionary/%E6%97%A5%E8%AA%9E/kaikki.org-dictionary-%E6%97%A5%E8%AA%9E.jsonl';

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

// kaikki part-of-speech → the app's Chinese labels. Real-word POS first; the
// rank drives which entry we trust when a headword has several (a noun entry
// beats the "character"/"name" entry for the same kanji).
const POS_MAP = {
  noun: '名词',
  verb: '动词',
  adj: '形容词',
  adj_noun: '形容动词',
  adnominal: '连体词',
  adv: '副词',
  adverb: '副词',
  particle: '助词',
  conj: '连词',
  conjunction: '连词',
  intj: '感叹词',
  interjection: '感叹词',
  pron: '代词',
  pronoun: '代词',
  num: '数词',
  numeral: '数词',
  counter: '量词',
  classifier: '量词',
  prefix: '接头词',
  suffix: '接尾词',
  phrase: '表达',
  proverb: '表达',
  name: '名词',
};
const POS_RANK = (pos) => {
  if (['noun', 'verb', 'adj', 'adj_noun', 'adv', 'adverb'].includes(pos)) return 0;
  if (['soft-redirect', 'unknown', undefined, null, ''].includes(pos)) return 2;
  return 1;
};

const KANA = /[ぁ-んァ-ヶー]/;
const KANA_ONLY = /^[ぁ-んァ-ヶーゔゕゖ・]+$/;
const HAN = /[一-鿿]/;
const TILDE = /[~～〜]/; // U+007E, U+FF5E, U+301C all mark bound affixes
// Skip a sense that is an explicit slang reading — wrong for a study app anyway.
const EXPLICIT = /性高潮|射精|性交|做爱|阴茎|阴道|生殖器/;
// Wiktionary meta / red-link noise rather than an actual meaning.
const JUNK = /尚未创建|义项/;

async function ensureSource(name, url) {
  const path = join(CACHE, name);
  try {
    await access(path);
    return path;
  } catch {
    process.stdout.write(`  downloading ${name} …`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(CACHE, { recursive: true });
    await writeFile(path, buf);
    process.stdout.write(` ${buf.length} bytes\n`);
    return path;
  }
}

// Minimal RFC-4180 CSV parser (handles quoted fields with embedded commas/quotes).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// The deck mixes clean vocabulary with grammar points, counters and affixes
// (お～, ～円, ～(て) しまう), lists alternate forms (足; 脚 / 回る、回す) and tags
// suru-verb readings with (する). Normalise to a single typeable headword, and
// drop the bound-morpheme / grammar entries — they don't work as flashcards.
const SPLIT = /[;；、，/／]/;

function normalizeTerm(raw) {
  let t = (raw || '').trim();
  if (!t || t === 'expression') return null;
  if (TILDE.test(t)) return null; // affix / grammar pattern
  t = t.split(SPLIT)[0]; // first of several written forms
  t = t.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, ''); // optional parts
  t = t.replace(/\s+/g, '').trim();
  return t || null;
}

function normalizeReading(raw, term) {
  let r = (raw || '').trim();
  if (TILDE.test(r)) return null;
  r = r.split(SPLIT)[0];
  r = r.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
  r = r.replace(/\s+/g, '').trim();
  // "けいけんする" for the noun 経験 → strip the する the deck tacks on, but keep it
  // for genuine する-verbs whose term already ends in する (察する).
  if (!/する$/.test(term) && /する$/.test(r) && r.length > 2) r = r.slice(0, -2);
  return r || null;
}

async function loadDeck() {
  const deck = new Map(); // term → { reading, en, level }  (lowest level wins)
  let dropped = 0;
  for (const lv of LEVELS) {
    const path = await ensureSource(`${lv}.csv`, DECK_URL(lv));
    const rows = parseCsv(await readFile(path, 'utf8'));
    for (const cols of rows) {
      if (cols.length < 3) continue;
      const term = normalizeTerm(cols[0]);
      if (!term) {
        if ((cols[0] || '').trim() && (cols[0] || '').trim() !== 'expression') dropped += 1;
        continue;
      }
      let reading = normalizeReading(cols[1], term);
      // The reading is what the learner types, so it must be kana. Fall back to
      // the term when the term itself is kana; otherwise the entry is untypeable.
      if (!reading || !KANA_ONLY.test(reading)) {
        if (KANA_ONLY.test(term)) reading = term;
        else {
          dropped += 1;
          continue;
        }
      }
      const en = (cols[2] || '').trim();
      if (!deck.has(term)) deck.set(term, { reading, en, level: lv.toUpperCase() });
    }
  }
  console.log(`  dropped ${dropped} affix/grammar entries (～ …)`);
  return deck;
}

// Build word → [{ pos, glosses }] for the headwords/readings we care about.
async function buildKaikkiIndex(interest) {
  const path = await ensureSource(
    'kaikki_ja.jsonl',
    KAIKKI_URL,
  );
  const index = new Map();
  const rl = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.lang_code !== 'ja') continue;
    const w = e.word;
    if (!interest.has(w)) continue;
    const glosses = [];
    for (const s of e.senses || []) {
      for (const g of s.glosses || []) glosses.push(g);
    }
    // The kanji spellings this entry belongs to — lets us verify a reading
    // lookup actually points at our headword (みる lists 見る) rather than a
    // homophone (あく lists 灰汁, not 開く).
    const kanjiForms = [];
    for (const fm of e.forms || []) {
      if ((fm.tags || []).includes('kanji') && fm.form) kanjiForms.push(fm.form);
    }
    if (!index.has(w)) index.set(w, []);
    index.get(w).push({ pos: e.pos, glosses, kanjiForms });
  }
  return index;
}

function cleanGloss(gloss) {
  // Convert to Simplified up front so every filter below matches (the raw
  // Wiktionary glosses are Traditional: 詞條/簡寫/…).
  let g = toSimplified((gloss || '').trim());
  if (!g) return null;
  if (JUNK.test(g)) return null; // red-link placeholder / meta jargon
  g = g.replace(/【[^】]*】/g, '').trim(); // drop 【…】 cross-references
  g = g.replace(/[\[［][^\]］]*[\]］]/g, '').trim(); // drop [用法] context notes
  g = g.replace(/:?\s*Template:[^\s；，、]*/gi, '').trim(); // drop :Template:… wiki junk
  g = g.replace(/（[^）]*[A-Za-z][^）]*）/g, '').trim(); // drop （romaji） notes
  g = g.replace(/\([^)]*[A-Za-z][^)]*\)/g, '').trim(); // …and half-width (natural)
  // "日曜日之简写：星期日" — keep the explanation after the marker.
  const abbr = g.match(/(?:简写|简称|缩写|略语|写法)[：:]\s*(.+)$/);
  if (abbr) g = abbr[1].trim();
  // "見る，視る： 看" / "女： 女人" — drop a short headword echo before the colon.
  const colon = g.indexOf('：');
  if (colon !== -1 && colon <= 8) {
    const left = g.slice(0, colon);
    const right = g.slice(colon + 1).trim();
    if (right && (KANA.test(left) || /^[一-鿿々〇、，·・\s]+$/.test(left))) g = right;
  }
  g = g.replace(/\s+/g, ' ').trim();
  g = g.replace(/\s*([，,、；;])\s*/g, '$1').trim(); // tidy spaces around punctuation
  g = g.replace(/[。．._：:，,、；;]+$/g, '').trim(); // trailing punctuation
  if (!g) return null;
  if (/^(男性|女性|日本)?人名$/.test(g) || /^姓氏?$/.test(g)) return null; // pure name sense
  if (KANA.test(g)) return null; // still Japanese → not a Chinese gloss
  if (!HAN.test(g)) return null; // no CJK at all → junk
  if (EXPLICIT.test(g)) return null;
  return g;
}

// Keep a definition flashcard-short: clause-truncate an over-long gloss, or give
// up (→ English fallback) when it has no clean short head.
function capGloss(m) {
  if (!m) return null;
  if (m.length <= 20) return m;
  const head = m.slice(0, 20);
  const sep = Math.max(head.lastIndexOf('；'), head.lastIndexOf('，'), head.lastIndexOf('、'));
  return sep >= 4 ? m.slice(0, sep) : null;
}

// Pull a concise Chinese gloss + POS from a set of kaikki entries for one word.
function extractSenses(entries) {
  if (!entries || !entries.length) return null;
  const sorted = [...entries].sort((a, b) => POS_RANK(a.pos) - POS_RANK(b.pos));
  const clean = [];
  let pos = '';
  for (const entry of sorted) {
    for (const raw of entry.glosses) {
      const g = cleanGloss(raw);
      if (!g || clean.includes(g)) continue;
      if (!pos) pos = POS_MAP[entry.pos] || '';
      clean.push(g);
      if (clean.length >= 3) break;
    }
    if (clean.length >= 3) break;
  }
  if (!clean.length) return null;
  // Prefer concise senses; only fall back to truncating a long definition when
  // every sense is a paragraph.
  const concise = clean.filter((s) => s.length <= 18);
  const meaning = concise.length
    ? concise[0].length >= 8
      ? concise[0]
      : concise.slice(0, 2).join('；')
    : capGloss(clean[0]);
  if (!meaning) return null;
  return { meaning, pos };
}

// Resolve the best Chinese gloss for a headword. Trust the kanji/kana headword's
// own entry first; only fall back to the reading for soft-redirect stubs (見る →
// みる). Merging both invites homophone poisoning (開く/あく → 灰汁, 水/みず → 御).
function resolveChinese(index, term, reading) {
  const fromTerm = extractSenses(index.get(term));
  if (fromTerm) return { ...fromTerm, src: 'term' };
  if (reading !== term) {
    // Only trust the reading when its entry explicitly claims our kanji form,
    // so みる → 見る is kept but あく → 灰汁 can't hijack 開く.
    const verified = (index.get(reading) || []).filter((e) => e.kanjiForms.includes(term));
    const fromReading = extractSenses(verified);
    if (fromReading) return { ...fromReading, src: 'reading' };
  }
  return null;
}

async function main() {
  console.log('Loading JLPT decks …');
  const deck = await loadDeck();
  console.log(`  ${deck.size} unique headwords across N5–N1`);

  const interest = new Set();
  for (const [term, info] of deck) {
    interest.add(term);
    interest.add(info.reading);
  }

  console.log('Indexing kaikki 日語 extract (Chinese Wiktionary) …');
  const index = await buildKaikkiIndex(interest);
  console.log(`  ${index.size} headwords matched in the Chinese extract`);

  const words = [];
  const perLevel = {};
  const readingSourced = [];
  for (const [term, info] of deck) {
    const zh = resolveChinese(index, term, info.reading);
    const hasZh = Boolean(zh?.meaning);
    if (zh?.src === 'reading') readingSourced.push(`${term}(${info.reading})→${zh.meaning} [en: ${info.en}]`);
    const id = 'jlpt-' + createHash('sha1').update(`${term}\t${info.reading}`).digest('hex').slice(0, 8);
    words.push({
      id,
      level: info.level,
      term,
      reading: info.reading,
      meaning: hasZh ? zh.meaning : info.en,
      meaningEn: info.en,
      partOfSpeech: zh?.pos || '',
      hasZh,
    });
    perLevel[info.level] = perLevel[info.level] || { count: 0, zh: 0 };
    perLevel[info.level].count += 1;
    if (hasZh) perLevel[info.level].zh += 1;
  }

  // Order N5 → N1, preserving deck order within a level.
  const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1'];
  words.sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));

  const zhTotal = words.filter((w) => w.hasZh).length;
  const manifest = {
    version: 1,
    dictionaries: [
      {
        id: 'jlpt',
        name: 'JLPT 词表',
        file: 'jlpt.json',
        description: 'JLPT N5–N1 分级词表，中文释义（缺失时回退英文）',
        totalCount: words.length,
        zhCount: zhTotal,
        levels: levelOrder.map((level) => ({
          level,
          label: LEVEL_LABELS[level],
          count: perLevel[level]?.count || 0,
          zhCount: perLevel[level]?.zh || 0,
        })),
      },
    ],
    attribution: [
      {
        name: 'open-anki-jlpt-decks',
        role: 'JLPT 分级、读音、英文释义',
        url: 'https://github.com/jamsinclair/open-anki-jlpt-decks',
        license: 'MIT',
      },
      {
        name: '中文维基词典（经 kaikki.org 提取）',
        role: '中文释义与词性',
        url: 'https://kaikki.org/zhwiktionary/',
        license: 'CC BY-SA 4.0',
      },
    ],
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'jlpt.json'), JSON.stringify(words), 'utf8');
  await writeFile(join(OUT, 'index.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\nWrote public/dictionaries/jlpt.json + index.json');
  console.log(`  total words: ${words.length}`);
  console.log(`  Chinese gloss: ${zhTotal} (${Math.round((100 * zhTotal) / words.length)}%), English fallback: ${words.length - zhTotal}`);
  for (const level of levelOrder) {
    const p = perLevel[level];
    if (p) console.log(`    ${level}: ${p.count} words, ${p.zh} zh (${Math.round((100 * p.zh) / p.count)}%)`);
  }
  console.log(`  reading-fallback (soft-redirect recovery): ${readingSourced.length} words`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
