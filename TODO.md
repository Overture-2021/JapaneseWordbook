# TODO

## Reading passages — bulk generation pipeline (deferred)

The 阅读 (reading) mode loads curated passages from `public/passages/`
(`index.json` manifest → collection files, mirroring `public/dictionaries/`).
`starter.json` holds two hand/subagent-authored passages for development. The
pipeline that generates passages *at scale* is deferred until the reading UX is
proven.

### Plan — `scripts/build-passages.mjs` (mirror `scripts/build-dictionaries.mjs`)

1. **Source** raw Japanese passages: a curated list, graded-reader text, or
   short generated passages per JLPT band.
2. **Segment + read + POS-tag** with a morphological analyzer run *offline* —
   [kuromoji.js](https://github.com/takuyaa/kuromoji.js) ships a ~15 MB dict; run
   it in the build script only, never bundle it into the app.
3. **Group into 文節 (bunsetsu)** — content word + trailing particles/auxiliaries
   — so alignment/reading units are natural (食べ + ました → 食べました).
4. **Align JA → translation** with a **cheap** LLM (DeepSeek / OpenAI — **not
   Claude**; translation alignment doesn't justify the cost). Prompt returns the
   `segment → translation-index` mapping as JSON.
5. **Spot-check**, then write `public/passages/<collection>.json` and add the
   file to `index.json`.

Keep output conforming to the schema below so the runtime loader
(`src/lib/passageLoader.js`) and `ReadingView` need no changes as the library grows.

### Passage schema (contract)

```jsonc
{
  "id": "n5-topic-01",           // unique, kebab-case
  "title": "早晨",                // short label (translation language)
  "level": "N5",
  "lang": "zh",                   // translation language: "zh" | "en"
  "segments": [
    {
      "surface": "私",           // JA as displayed; surfaces concatenate to the passage
      "reading": "わたし",        // hiragana; "" for punctuation. Must romanize to [a-z-] (WanaKana)
      "pos": "pronoun",          // noun|verb|adj-i|adj-na|adverb|particle|aux|pronoun|conjunction|…|punct
      "trans": [0]               // indices into "translation", or null if no correspondent
    }
  ],
  "translation": ["我", "每天早上", "六点", "…"]  // display tokens; zh joins adjacent, en joins with spaces
}
```

### Alignment rules

- Particles / auxiliaries / punctuation with no content correspondent →
  `"trans": null`. This is what drives the "no-translation" highlight colour on
  the current-word highlighter. (A particle *can* carry a `trans` when it maps
  cleanly, e.g. と → 和.)
- Alignment is many-to-many and **non-monotonic** — Japanese is SOV, Chinese/
  English SVO, so `trans` indices need not increase across segments.
- One segment may map to several tokens (`[1, 2]`).

### Runtime pieces already in place

- `src/lib/passageLoader.js` — fetch + flatten from the manifest.
- `src/lib/passage.js` — `buildPassageTyping` (per-segment `kind`/keys/spans),
  `matchReading` (IME kana matcher), `matchSegment` (dispatcher), `PUNCT_KEYS`.
- `src/components/ReadingView.jsx` — type-along UI + dual highlighters,
  paragraph breaks, and auto-scroll of the active word.

### Punctuation & structure

- Punctuation keeps `reading: ""` and is **never typed** — the cursor skips it,
  and it renders permanently dimmed. Pressing 。 or 『 teaches nothing, and it
  would need plain-keyboard stand-ins (WanaKana can't even produce 『 from `"`).
  Anything without a reading is skipped, so this needs no per-mark table.
- Paragraph breaks are a `{ "pos": "break", "surface": "", "reading": "" }`
  segment (no newline characters elsewhere); `ReadingView` renders them as a
  vertical gap.
- Katakana words store a **hiragana** reading (ユーフォニアム → ゆうふぉにあむ) so the
  IME matcher and the guide work.
- **Never use `toRomaji` to tell a learner which keys to press.** It is a
  transliteration, not IME input: it renders ふぉ as `fuo` (which types back as
  ふお) and ん as a bare `n` (which an IME leaves pending forever) — either makes
  a passage impossible to finish. Use `typingKeys` in `src/lib/passage.js`, which
  builds keys per mora and verifies each round-trips. A test asserts
  `getKanaPreview(typingKeys(reading)) === reading` for every shipped reading, and
  an e2e types a whole passage to the end; keep both when adding passages.
- Known IME divergence: WanaKana parses `onna` as おんあ (greedy `nn`→ん), while
  MS-IME gives おんな. The guide therefore shows `onnnanoko` for おんなのこ, which
  works in both. A learner typing the MS-IME-natural `onnanoko` is marked wrong.

## Known limitations / follow-ups

- Reading mode matches input the IME way: typed romaji → kana (WanaKana IME mode)
  → compared as kana, so all standard spellings are accepted (shi/si, tsu/tu,
  fu/hu, ji/zi, chi/ti, sha/sya, nn…). See `matchReading` in `src/lib/passage.js`.
  The **recite** live keystroke guide still compares one canonical romaji form;
  align it with `matchReading` if learners hit friction there too.
- The current-segment guide shows one canonical spelling as a hint even though
  alternates are accepted — fine as a hint, but note it isn't "the only way".
- `と → 和` aside, connective particles are generally left `null`; revisit if the
  bulk aligner should map them.
