// Loads reading passages published under public/passages/. Mirrors
// dictionaryLoader: an index.json manifest lists one or more collection files;
// we fetch them all once and hand the app a flat passage list plus the manifest.
// Fetched lazily on first entry into reading mode so startup stays fast.

const BASE = import.meta.env.BASE_URL;

let cache;

async function fetchJson(name) {
  const res = await fetch(`${BASE}passages/${name}`);
  if (!res.ok) throw new Error(`短文加载失败（${name}: HTTP ${res.status}）`);
  return res.json();
}

export async function loadPassages() {
  if (!cache) {
    cache = (async () => {
      const manifest = await fetchJson('index.json');
      const files = manifest.files ?? [];
      const chunks = await Promise.all(files.map(fetchJson));
      return { passages: chunks.flat(), manifest };
    })().catch((error) => {
      cache = undefined; // let the caller retry after a failure
      throw error;
    });
  }
  return cache;
}
