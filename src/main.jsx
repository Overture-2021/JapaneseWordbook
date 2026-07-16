import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadDictionary } from './lib/dictionaryLoader';
import './styles.css';

function Splash({ children }) {
  return (
    <div className="app-splash">
      <div className="brand-mark" aria-hidden="true">言</div>
      <strong>言葉帳</strong>
      <p>{children}</p>
    </div>
  );
}

// The word data is fetched from public/dictionaries/ before the app renders, so
// App can keep treating the dictionary as synchronously available.
function Bootstrap() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    loadDictionary()
      .then((data) => alive && setState({ status: 'ready', ...data }))
      .catch((error) => alive && setState({ status: 'error', error }));
    return () => {
      alive = false;
    };
  }, [state.attempt]);

  if (state.status === 'loading') return <Splash>词库加载中…</Splash>;
  if (state.status === 'error') {
    return (
      <Splash>
        词库加载失败。
        <button
          className="new-batch-button"
          onClick={() => setState({ status: 'loading', attempt: (state.attempt || 0) + 1 })}
          type="button"
        >
          重试
        </button>
      </Splash>
    );
  }
  return <App dictionary={state.words} manifest={state.manifest} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
