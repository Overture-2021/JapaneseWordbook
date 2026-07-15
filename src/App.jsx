import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Cloud, CloudOff } from 'lucide-react';
import { CloudSyncDialog } from './components/CloudSyncDialog';
import { DictionaryDrawer } from './components/DictionaryDrawer';
import { ResultsView } from './components/ResultsView';
import { MobileNav, Sidebar } from './components/Sidebar';
import { ReciteCard, TestCard } from './components/StudyCard';
import { StudyToolbar } from './components/StudyToolbar';
import { DICTIONARY, LEVEL_LABELS } from './data/dictionary';
import {
  authenticateGitHub,
  getCloudState,
  saveCloudState,
} from './lib/githubSync';
import { resolveRepository } from './lib/repository';
import { createSession } from './lib/session';
import {
  getTodayStats,
  loadGitHubProfile,
  loadProgress,
  loadSession,
  loadSettings,
  mergeProgress,
  normalizeCloudState,
  recordResult,
  saveGitHubProfile,
  saveProgress,
  saveSession,
  saveSettings,
} from './lib/storage';
import { isCorrectAnswer } from './lib/typing';

const REPOSITORY = resolveRepository({
  hostname: typeof window !== 'undefined' ? window.location.hostname : '',
  baseUrl: import.meta.env.BASE_URL,
});

const MODE_COPY = {
  recite: { title: '背诵', japanese: '言葉を覚える', accent: '记忆' },
  read: { title: '认读测试', japanese: '読みを確かめる', accent: '日 → 音' },
  write: { title: '默写测试', japanese: '言葉を書き出す', accent: '中 → 日' },
};

const WORDS_BY_ID = Object.fromEntries(DICTIONARY.map((word) => [word.id, word]));

const isValidSession = (session) =>
  session &&
  ['recite', 'read', 'write'].includes(session.mode) &&
  Array.isArray(session.batchIds) &&
  session.batchIds.length > 0 &&
  session.batchIds.every((id) => WORDS_BY_ID[id]) &&
  session.index >= 0 &&
  session.index < session.batchIds.length;

const getInitialSession = () => {
  const saved = loadSession();
  return isValidSession(saved) ? saved : createSession(loadSettings());
};

function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [progress, setProgress] = useState(loadProgress);
  const [session, setSession] = useState(getInitialSession);
  const [answer, setAnswer] = useState('');
  const [reciteTyped, setReciteTyped] = useState('');
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudConnection, setCloudConnection] = useState(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [githubProfile, setGithubProfile] = useState(loadGitHubProfile);
  const [autoSync, setAutoSync] = useState(
    () => loadGitHubProfile()?.autoSync ?? true,
  );
  const autoSyncedSession = useRef(null);

  const batchWords = useMemo(
    () => session.batchIds.map((id) => WORDS_BY_ID[id]).filter(Boolean),
    [session.batchIds],
  );
  const currentWord = batchWords[session.index];
  const currentResult =
    session.cardState === 'feedback'
      ? [...session.results].reverse().find((result) => result.wordId === currentWord?.id)
      : null;
  const todayStats = getTodayStats(progress);
  const modeCopy = MODE_COPY[session.mode];

  const levelMastered = useMemo(() => {
    const levelWords = DICTIONARY.filter((word) => word.level === settings.level);
    return levelWords.filter((word) => {
      const stats = progress.words[word.id];
      return stats?.seen >= 3 && stats.correct / stats.seen >= 0.8;
    }).length;
  }, [progress, settings.level]);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveSession(session), [session]);

  useEffect(() => {
    setAnswer('');
    setReciteTyped('');
  }, [session.index, session.mode, session.startedAt]);

  useEffect(() => {
    if (
      settings.autoSpeak &&
      session.phase === 'active' &&
      session.mode === 'recite' &&
      currentWord
    ) {
      const timer = window.setTimeout(() => speak(currentWord), 180);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [currentWord, session.mode, session.phase, settings.autoSpeak]);

  const speak = (word) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.term);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  };

  const startSession = (mode = session.mode, words) => {
    setSession(createSession(settings, mode, words));
    setAnswer('');
    setReciteTyped('');
  };

  const changeMode = (mode) => {
    if (mode === session.mode && session.phase === 'active') return;
    startSession(mode);
  };

  const changeSettings = (nextSettings) => {
    const levelChanged = nextSettings.level !== settings.level;
    setSettings(nextSettings);
    if (levelChanged) {
      setSession(createSession(nextSettings, session.mode));
    }
  };

  const appendResult = (correct, submittedAnswer = '') => {
    if (!currentWord) return null;
    const result = {
      wordId: currentWord.id,
      correct,
      answer: submittedAnswer,
      answeredAt: new Date().toISOString(),
    };
    setProgress((previous) => recordResult(previous, currentWord.id, correct));
    return result;
  };

  const handleReciteChoice = (correct) => {
    if (!currentWord) return;
    // With free navigation you can revisit a graded card; only count it toward
    // progress once, and replace the earlier result instead of appending.
    const alreadyGraded = session.results.some(
      (item) => item.wordId === currentWord.id,
    );
    if (!alreadyGraded) {
      setProgress((previous) => recordResult(previous, currentWord.id, correct));
    }
    const result = {
      wordId: currentWord.id,
      correct,
      answer: reciteTyped,
      answeredAt: new Date().toISOString(),
    };
    setSession((previous) => {
      const results = alreadyGraded
        ? previous.results.map((item) =>
            item.wordId === currentWord.id ? result : item,
          )
        : [...previous.results, result];
      if (previous.index === previous.batchIds.length - 1) {
        return { ...previous, results, phase: 'results', cardState: 'prompt' };
      }
      return {
        ...previous,
        results,
        index: previous.index + 1,
        cardState: 'prompt',
      };
    });
  };

  const navigate = (delta) => {
    setSession((previous) => {
      const index = Math.min(
        Math.max(previous.index + delta, 0),
        previous.batchIds.length - 1,
      );
      if (index === previous.index) return previous;
      return { ...previous, index, cardState: 'prompt' };
    });
  };

  const handleTestSubmit = () => {
    if (!currentWord || session.cardState === 'feedback' || !answer.trim()) return;
    const correct = isCorrectAnswer(answer, currentWord);
    const result = appendResult(correct, answer.trim());
    if (!result) return;
    setSession((previous) => ({
      ...previous,
      results: [...previous.results, result],
      cardState: 'feedback',
    }));
  };

  const handleTestAdvance = () => {
    if (session.cardState !== 'feedback') return;
    if (session.index === session.batchIds.length - 1) {
      setSession((previous) => ({
        ...previous,
        phase: 'results',
        cardState: 'prompt',
      }));
      return;
    }
    setSession((previous) => ({
      ...previous,
      index: previous.index + 1,
      cardState: 'prompt',
    }));
  };

  const repeatMistakes = () => {
    const mistakeWords = session.results
      .filter((result) => !result.correct)
      .map((result) => WORDS_BY_ID[result.wordId])
      .filter(Boolean);
    if (mistakeWords.length) startSession(session.mode, mistakeWords);
  };

  const connectGitHub = async (token) => {
    setCloudBusy(true);
    setCloudError('');
    try {
      const user = await authenticateGitHub(token);
      const remote = await getCloudState({
        token,
        username: user.login,
        ...REPOSITORY,
      });
      // Pull-merge on connect so both devices converge immediately; progress
      // only grows, so this can never discard what's already on this device.
      if (remote?.state?.progress) {
        setProgress((previous) => mergeProgress(previous, remote.state.progress));
      }
      setCloudConnection({ token, user, remote });
      const profile = { username: user.login, autoSync };
      setGithubProfile(profile);
      saveGitHubProfile(profile);
    } catch (error) {
      setCloudError(error.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const uploadCloudState = async () => {
    if (!cloudConnection || cloudBusy) return;
    setCloudBusy(true);
    setCloudError('');
    const target = {
      token: cloudConnection.token,
      username: cloudConnection.user.login,
      ...REPOSITORY,
    };
    try {
      // Pull first and merge per word, so finishing a batch here never
      // overwrites progress synced from another device. If a concurrent write
      // lands between our read and write, GitHub rejects the stale sha (409);
      // re-pull, re-merge, and retry — the merge is idempotent so it converges.
      let remote = await getCloudState(target);
      let merged = mergeProgress(progress, remote?.state?.progress);
      for (let attempt = 0; attempt <= 2; attempt += 1) {
        try {
          await saveCloudState({
            ...target,
            state: { settings, progress: merged, session },
            sha: remote ? remote.sha : null,
          });
          break;
        } catch (error) {
          if (error.status !== 409 || attempt === 2) throw error;
          remote = await getCloudState(target);
          merged = mergeProgress(merged, remote?.state?.progress);
        }
      }
      setProgress((previous) => mergeProgress(previous, merged));
      const refreshed = await getCloudState(target);
      setCloudConnection((previous) => ({ ...previous, remote: refreshed }));
    } catch (error) {
      setCloudError(error.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const downloadCloudState = async () => {
    if (!cloudConnection || cloudBusy) return;
    setCloudBusy(true);
    setCloudError('');
    try {
      const remote = await getCloudState({
        token: cloudConnection.token,
        username: cloudConnection.user.login,
        ...REPOSITORY,
      });
      if (!remote?.state) {
        setCloudError('云端暂无数据');
        return;
      }
      const cloud = normalizeCloudState(remote.state);
      // Merge rather than replace so pulling never discards local study.
      setProgress((previous) => mergeProgress(previous, cloud.progress));
      setSettings(cloud.settings);
      setSession(
        isValidSession(cloud.session)
          ? cloud.session
          : createSession(cloud.settings, session.mode),
      );
      setCloudConnection((previous) => ({ ...previous, remote }));
      setCloudOpen(false);
    } catch (error) {
      setCloudError(error.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const updateAutoSync = (next) => {
    setAutoSync(next);
    const profile = {
      username: cloudConnection?.user.login || githubProfile?.username,
      autoSync: next,
    };
    setGithubProfile(profile);
    saveGitHubProfile(profile);
  };

  useEffect(() => {
    if (
      session.phase !== 'results' ||
      !cloudConnection ||
      !autoSync ||
      autoSyncedSession.current === session.startedAt
    ) {
      return;
    }
    autoSyncedSession.current = session.startedAt;
    uploadCloudState();
  }, [autoSync, cloudConnection, session.phase, session.startedAt]);

  const progressPercent = batchWords.length
    ? Math.round(((session.index + (session.cardState === 'feedback' ? 1 : 0)) / batchWords.length) * 100)
    : 0;

  return (
    <div className="app-shell">
      <Sidebar
        activeMode={session.mode}
        cloudConnected={Boolean(cloudConnection)}
        onModeChange={changeMode}
        onOpenCloud={() => setCloudOpen(true)}
        onOpenDictionary={() => setDictionaryOpen(true)}
        todayStats={todayStats}
      />

      <main className="app-main">
        <header className="mobile-header">
          <div className="brand compact">
            <div className="brand-mark" aria-hidden="true">言</div>
            <strong>言葉帳</strong>
          </div>
          <div className="mobile-header-actions">
            <button
              aria-label="打开词库"
              className="icon-button"
              onClick={() => setDictionaryOpen(true)}
              title="词库"
              type="button"
            >
              <BookOpen size={20} />
            </button>
            <button
              aria-label="打开云端同步"
              className="icon-button"
              onClick={() => setCloudOpen(true)}
              title="云端同步"
              type="button"
            >
              {cloudConnection ? <Cloud size={20} /> : <CloudOff size={20} />}
            </button>
          </div>
        </header>

        <div className="main-content">
          <header className="page-header">
            <div>
              <div className="page-eyebrow">
                <span>{modeCopy.accent}</span>
                <i />
                <span>{settings.level} · {LEVEL_LABELS[settings.level]}</span>
              </div>
              <h1>{modeCopy.title}</h1>
              <p className="japanese-text">{modeCopy.japanese}</p>
            </div>
            <div className="level-progress-summary">
              <span>{settings.level} 已掌握</span>
              <strong>{levelMastered}<small>/25</small></strong>
            </div>
          </header>

          <StudyToolbar
            onChange={changeSettings}
            onNewBatch={() => startSession()}
            settings={settings}
          />

          {session.phase === 'active' ? (
            <>
              <div
                className={`session-progress-row${session.mode === 'recite' ? ' with-nav' : ''}`}
              >
                {session.mode === 'recite' && (
                  <div className="batch-nav" aria-label="批次导航">
                    <button
                      aria-label="上一词（←）"
                      disabled={session.index === 0}
                      onClick={() => navigate(-1)}
                      title="上一词（←）"
                      type="button"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      aria-label="下一词（→）"
                      disabled={session.index === batchWords.length - 1}
                      onClick={() => navigate(1)}
                      title="下一词（→）"
                      type="button"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
                <div className="session-progress-count">
                  <span>本批进度</span>
                  <strong>{session.index + 1} / {batchWords.length}</strong>
                </div>
                <div className="session-progress-track" aria-label={`批次进度 ${progressPercent}%`}>
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="session-mode-code">{modeCopy.accent}</span>
              </div>

              <div className="study-stage">
                {session.mode === 'recite' ? (
                  <ReciteCard
                    key={currentWord.id}
                    onChoice={handleReciteChoice}
                    onNext={() => navigate(1)}
                    onPrev={() => navigate(-1)}
                    onSpeak={speak}
                    onTyped={setReciteTyped}
                    typed={reciteTyped}
                    word={currentWord}
                  />
                ) : (
                  <TestCard
                    answer={currentResult?.answer ?? answer}
                    key={currentWord.id}
                    mode={session.mode}
                    onAdvance={handleTestAdvance}
                    onAnswer={setAnswer}
                    onSpeak={speak}
                    onSubmit={handleTestSubmit}
                    result={currentResult}
                    word={currentWord}
                  />
                )}
              </div>
            </>
          ) : (
            <ResultsView
              mode={session.mode}
              onNewBatch={() => startSession()}
              onRepeat={repeatMistakes}
              results={session.results}
              wordsById={WORDS_BY_ID}
            />
          )}

          <footer className="app-footer">
            <span>125 词 · N5–N1</span>
            <span>本地自动保存{cloudConnection ? ' · GitHub 已连接' : ''}</span>
          </footer>
        </div>
      </main>

      <MobileNav activeMode={session.mode} onModeChange={changeMode} />

      <DictionaryDrawer
        onClose={() => setDictionaryOpen(false)}
        onSpeak={speak}
        open={dictionaryOpen}
      />
      <CloudSyncDialog
        autoSync={autoSync}
        busy={cloudBusy}
        connection={cloudConnection}
        error={cloudError}
        lastProfile={githubProfile}
        onAutoSync={updateAutoSync}
        onClose={() => {
          setCloudOpen(false);
          setCloudError('');
        }}
        onConnect={connectGitHub}
        onDisconnect={() => {
          setCloudConnection(null);
          setCloudError('');
        }}
        onDownload={downloadCloudState}
        onUpload={uploadCloudState}
        open={cloudOpen}
        repository={REPOSITORY}
      />
    </div>
  );
}

export default App;
