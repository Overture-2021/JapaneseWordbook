import { Search, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { JLPT_LEVELS } from '../data/dictionary';
import { getWordForms } from '../lib/typing';

const RENDER_CAP = 200; // the list can hold thousands of words; cap the DOM

export function DictionaryDrawer({ open, onClose, onSpeak, words = [], attribution }) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('ALL');
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return words.filter((word) => {
      const forms = getWordForms(word);
      const levelMatch = level === 'ALL' || word.level === level;
      const queryMatch =
        !normalized ||
        [word.term, word.reading, word.meaning, word.meaningEn, forms.romaji]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      return levelMatch && queryMatch;
    });
  }, [level, query, words]);

  const visible = filtered.slice(0, RENDER_CAP);

  if (!open) return null;

  return (
    <div className="dialog-layer" role="presentation">
      <button
        aria-label="关闭词库"
        className="dialog-backdrop"
        onClick={onClose}
        tabIndex="-1"
        type="button"
      />
      <aside
        aria-labelledby="dictionary-title"
        aria-modal="true"
        className="dictionary-drawer"
        role="dialog"
      >
        <header className="drawer-header">
          <div>
            <span>辞書</span>
            <h2 id="dictionary-title">日中词库</h2>
          </div>
          <button
            aria-label="关闭词库"
            className="icon-button"
            onClick={onClose}
            ref={closeRef}
            title="关闭"
            type="button"
          >
            <X size={21} />
          </button>
        </header>

        <div className="dictionary-controls">
          <label className="search-field">
            <Search size={18} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="日语、中文或 romaji"
              type="search"
              value={query}
            />
          </label>
          <div className="dictionary-levels" aria-label="词库等级">
            {['ALL', ...JLPT_LEVELS].map((item) => (
              <button
                className={level === item ? 'active' : ''}
                key={item}
                onClick={() => setLevel(item)}
                type="button"
              >
                {item === 'ALL' ? '全部' : item}
              </button>
            ))}
          </div>
        </div>

        <div className="dictionary-count">
          <span>{filtered.length} 词</span>
          <span className="dictionary-count-note">
            {filtered.length > RENDER_CAP ? `显示前 ${RENDER_CAP} 条，输入搜索缩小范围` : 'JLPT 分级为学习参考'}
          </span>
        </div>

        <div className="dictionary-list">
          {visible.map((word) => {
            const forms = getWordForms(word);
            return (
              <article className="dictionary-row" key={word.id}>
                <span className={`level-chip level-${word.level.toLowerCase()}`}>
                  {word.level}
                </span>
                <div className="dictionary-japanese">
                  <strong className="japanese-text">{word.term}</strong>
                  <span className="japanese-text">{word.reading}</span>
                </div>
                <span className="dictionary-romaji">{forms.romaji}</span>
                <div className="dictionary-meaning">
                  <strong>{word.meaning}</strong>
                  <span>
                    {[word.partOfSpeech, word.hasZh ? word.meaningEn : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <button
                  aria-label={`播放 ${word.term} 的读音`}
                  className="icon-button small"
                  onClick={() => onSpeak(word)}
                  title="播放读音"
                  type="button"
                >
                  <Volume2 size={17} />
                </button>
              </article>
            );
          })}
        </div>

        <footer className="drawer-footer">
          现代 JLPT 不公布固定词汇表；等级依据常见学习资料近似整理。
        </footer>

        {attribution?.length ? (
          <div className="dictionary-attribution">
            <strong>词库来源</strong>
            {attribution.map((source) => (
              <div key={source.name}>
                <a href={source.url} rel="noreferrer" target="_blank">
                  {source.name}
                </a>
                {source.role ? ` — ${source.role}` : ''}
                {source.license ? `（${source.license}）` : ''}
              </div>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
