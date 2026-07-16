# Dictionary data attribution

The vocabulary served from [`public/dictionaries/`](public/dictionaries/) is built
from open data by [`scripts/build-dictionaries.mjs`](scripts/build-dictionaries.mjs).
Each word carries a JLPT level, a kana reading, a meaning (Chinese where available,
English otherwise), and — where known — a part of speech.

## Sources

| Source | Provides | License |
| --- | --- | --- |
| [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) | JLPT N5–N1 grading, kana readings, English glosses | MIT |
| [Chinese Wiktionary (中文维基词典)](https://zh.wiktionary.org/), extracted via [kaikki.org](https://kaikki.org/zhwiktionary/) | Chinese glosses and parts of speech | CC BY-SA 4.0 |

The JLPT list is the spine and covers 100% of the ~7,600 headwords. Chinese glosses
come from the Chinese Wiktionary extract and cover roughly 45% of the list; the rest
fall back to the English gloss. Traditional-Chinese glosses are converted to Simplified
with [opencc-js](https://github.com/nk2028/opencc-js).

If any English gloss in the JLPT decks derives from JMdict/EDICT, that data is the
property of the [Electronic Dictionary Research and Development Group (EDRDG)](https://www.edrdg.org/)
and is used under the terms of its licence.

## Share-alike

Because the Chinese glosses are derived from Wiktionary, the generated data files in
`public/dictionaries/` are made available under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Attribution and the
share-alike requirement travel with that data; the application source code is covered
by the repository's own licence.

## Regenerating

```sh
node scripts/build-dictionaries.mjs
```

The script downloads its sources into `scripts/.cache/` (git-ignored) on first run and
emits `public/dictionaries/jlpt.json` plus the `index.json` manifest, which records the
per-source attribution shown in the app's dictionary drawer.
