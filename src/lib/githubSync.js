const API_ROOT = 'https://api.github.com';
const API_VERSION = '2022-11-28';

const headers = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': API_VERSION,
});

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `GitHub request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
};

const encodeBase64 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const decodeBase64 = (value) => {
  const binary = window.atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const authenticateGitHub = (token) =>
  request(`${API_ROOT}/user`, { headers: headers(token) });

export const getCloudState = async ({ token, owner, repo, branch, username }) => {
  const path = `user-data/${username}.json`;
  const url = `${API_ROOT}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(url, { headers: headers(token) });

  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `GitHub request failed (${response.status})`);
  }

  const file = await response.json();
  return {
    sha: file.sha,
    state: JSON.parse(decodeBase64(file.content)),
  };
};

export const saveCloudState = async ({
  token,
  owner,
  repo,
  branch,
  username,
  state,
}) => {
  const path = `user-data/${username}.json`;
  const existing = await getCloudState({
    token,
    owner,
    repo,
    branch,
    username,
  });
  const payload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    ...state,
  };

  return request(`${API_ROOT}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      ...headers(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `chore(data): sync ${username} study state`,
      content: encodeBase64(JSON.stringify(payload, null, 2)),
      branch,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    }),
  });
};
