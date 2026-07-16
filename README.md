# 言葉帳 Kotobacho

A compact Japanese keyboard and vocabulary trainer for Chinese-speaking learners. It loads a ~7,600-word JLPT N5–N1 dictionary built from open data — Chinese meanings where available, English otherwise. See [Dictionary data](#dictionary-data).

## Study modes

- **背诵**: written form, hiragana, katakana, romaji keystrokes, speech, and type-along keyboard guidance
- **认读测试**: Japanese prompt to kana reading, accepting romaji, kana, or native Japanese input
- **默写测试**: Chinese prompt to Japanese production, accepting written Japanese or its reading
- Configurable 1-25 word batches, shuffle, immediate feedback, mistake review, searchable dictionary, and per-word progress

## Dictionary data

The dictionary is fetched at runtime from [`public/dictionaries/`](public/dictionaries/) (a per-dictionary JSON file plus an `index.json` manifest), not bundled into the app. The assets are generated from open data by [`scripts/build-dictionaries.mjs`](scripts/build-dictionaries.mjs), which joins the [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) JLPT lists (grading, readings, English) with Chinese glosses from the [Chinese Wiktionary](https://zh.wiktionary.org/) extract on [kaikki.org](https://kaikki.org/zhwiktionary/). Regenerate with:

```bash
node scripts/build-dictionaries.mjs
```

Sources, licences, and the CC BY-SA share-alike obligation are documented in [ATTRIBUTIONS.md](ATTRIBUTIONS.md); the same credits appear in the app's dictionary drawer.

## Local development

```bash
npm install
npm run dev
```

Tests and production build:

```bash
npm test
npm run build
```

## Persistence

Settings, the active batch, and study progress are saved automatically in browser `localStorage`.

Optional GitHub sync uses the repository Contents API to write `user-data/<github-login>.json` on `main`. The sync target (owner and repository) is derived from the deployment URL, so a fork published to `https://<you>.github.io/JapaneseWordbook/` syncs to **your own fork** rather than upstream; off `github.io` (local dev, custom domains) it falls back to the upstream default. A fine-grained personal access token must grant **Contents: Read and write** for that repository. The token is held only in React memory and is discarded when the tab closes; it is never committed or written to browser storage.

Progress is reconciled per word when syncing rather than overwritten, so studying on more than one device merges instead of clobbering. Connecting, pulling, and the auto-sync-on-batch upload all pull-then-merge first, so no sync direction discards local study; a concurrent write is retried on conflict. Settings still follow last-write-wins.

This repository is public, so synced study-state JSON is public too. Data-only commits under `user-data/**` are excluded from the Pages deployment trigger.

## GitHub Pages

The workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) runs tests, builds the Vite app, and deploys the artifact with GitHub's official Pages actions. The Vite base path is configured for:

`https://overture-2021.github.io/JapaneseWordbook/`

In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions** if it is not selected already.

## Notes and credits

- JLPT no longer publishes fixed vocabulary lists. The bands in this app are approximate learning groupings, not official test specifications.
- Dictionary data comes from open-anki-jlpt-decks (MIT) and the Chinese Wiktionary (CC BY-SA 4.0); see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- Romaji and kana conversion is provided by [WanaKana](https://wanakana.com/).
- The sidebar crop is Katsushika Hokusai's *The Great Wave off Kanagawa*, from [LACMA via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Great_Wave_off_Kanagawa_LACMA_M.81.91.2_(1_of_2).jpg), released as a public-domain high-resolution image.
- Product flow references include focused kana drills, WaniKani's paired meaning/reading review, and KameSame's production-oriented recall direction.
