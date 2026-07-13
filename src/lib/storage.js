const SETTINGS_KEY = 'kotobacho.settings.v1';
const PROGRESS_KEY = 'kotobacho.progress.v1';
const SESSION_KEY = 'kotobacho.session.v1';
const GITHUB_PROFILE_KEY = 'kotobacho.github-profile.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  level: 'N5',
  batchSize: 20,
  shuffle: true,
  autoSpeak: false,
});

export const EMPTY_PROGRESS = Object.freeze({
  words: {},
  daily: {},
});

const readJSON = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The app remains usable in browsers where storage is disabled.
  }
};

export const loadSettings = () => ({
  ...DEFAULT_SETTINGS,
  ...readJSON(SETTINGS_KEY, {}),
});

export const saveSettings = (settings) => writeJSON(SETTINGS_KEY, settings);

export const loadProgress = () => readJSON(PROGRESS_KEY, EMPTY_PROGRESS);

export const saveProgress = (progress) => writeJSON(PROGRESS_KEY, progress);

export const loadSession = () => readJSON(SESSION_KEY, null);

export const saveSession = (session) => writeJSON(SESSION_KEY, session);

export const loadGitHubProfile = () => readJSON(GITHUB_PROFILE_KEY, null);

export const saveGitHubProfile = (profile) =>
  writeJSON(GITHUB_PROFILE_KEY, profile);

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const recordResult = (progress, wordId, correct) => {
  const dateKey = getLocalDateKey();
  const word = progress.words[wordId] || { seen: 0, correct: 0, wrong: 0 };
  const daily = progress.daily[dateKey] || { seen: 0, correct: 0 };

  return {
    words: {
      ...progress.words,
      [wordId]: {
        ...word,
        seen: word.seen + 1,
        correct: word.correct + (correct ? 1 : 0),
        wrong: word.wrong + (correct ? 0 : 1),
        lastSeen: new Date().toISOString(),
      },
    },
    daily: {
      ...progress.daily,
      [dateKey]: {
        seen: daily.seen + 1,
        correct: daily.correct + (correct ? 1 : 0),
      },
    },
  };
};

export const getTodayStats = (progress) => {
  const today = progress.daily[getLocalDateKey()] || { seen: 0, correct: 0 };
  return {
    ...today,
    accuracy: today.seen ? Math.round((today.correct / today.seen) * 100) : 0,
  };
};

export const mergeCloudState = (cloud) => ({
  settings: { ...DEFAULT_SETTINGS, ...(cloud.settings || {}) },
  progress: cloud.progress || EMPTY_PROGRESS,
  session: cloud.session || null,
});
