// Loads the dictionary assets published under public/dictionaries/. The manifest
// lists one or more dictionary files (JLPT today, others later); we fetch them
// all once and hand the app a single flat word list plus the manifest metadata.

const BASE = import.meta.env.BASE_URL;

let cache;

async function fetchJson(name) {
  const res = await fetch(`${BASE}dictionaries/${name}`);
  if (!res.ok) throw new Error(`词库加载失败（${name}: HTTP ${res.status}）`);
  return res.json();
}

export async function loadDictionary() {
  if (!cache) {
    cache = (async () => {
      const manifest = await fetchJson('index.json');
      const files = manifest.dictionaries.map((entry) => entry.file);
      const chunks = await Promise.all(files.map(fetchJson));
      return { words: chunks.flat(), manifest };
    })().catch((error) => {
      cache = undefined; // let the caller retry after a failure
      throw error;
    });
  }
  return cache;
}
