export const DEFAULT_REPOSITORY = Object.freeze({
  owner: 'Overture-2021',
  repo: 'JapaneseWordbook',
  branch: 'main',
});

const GITHUB_PAGES_HOST = /^([a-z0-9-]+)\.github\.io$/i;

const firstPathSegment = (baseUrl) =>
  (baseUrl || '').replace(/^\/+|\/+$/g, '').split('/')[0];

// A fork published to <owner>.github.io/<repo>/ should sync to *that* fork, not
// upstream. Project Pages encode both facts in the deployment URL: the owner is
// the github.io subdomain and the repo is the base-path segment (which Vite's
// `base` already pins to the repo name). Off github.io — local dev, custom
// domains — we can't trust the host, so fall back to the upstream default.
export const resolveRepository = (
  { hostname, baseUrl } = {},
  fallback = DEFAULT_REPOSITORY,
) => {
  const match = (hostname || '').match(GITHUB_PAGES_HOST);
  if (!match) return { ...fallback };
  return {
    owner: match[1],
    repo: firstPathSegment(baseUrl) || fallback.repo,
    branch: fallback.branch,
  };
};
