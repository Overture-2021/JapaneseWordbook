import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Volume2 } from 'lucide-react';
import { buildPassageTyping, matchSegment } from '../lib/passage';

function CurrentGuide({ segment, match }) {
  // Per-key hint for the segment the cursor is in: typed keys are done, the next
  // expected key is current (or wrong when the last keystroke missed). Shows the
  // kana for words, or the Japanese mark for punctuation typed via its key.
  return (
    <div className="reading-guide">
      <span className="reading-guide-kana japanese-text">
        {segment.reading || segment.surface}
      </span>
      <div className="reading-guide-keys" aria-label={`输入 ${segment.romaji}`}>
        {segment.romaji.split('').map((char, index) => (
          <kbd
            className={
              index < match.matched
                ? 'done'
                : index === match.matched
                  ? match.wrong
                    ? 'wrong'
                    : 'current'
                  : ''
            }
            key={`${char}-${index}`}
          >
            {char}
          </kbd>
        ))}
      </div>
    </div>
  );
}

export function ReadingView({ passages, error, onSpeak }) {
  const [passageId, setPassageId] = useState(null);
  const [pos, setPos] = useState(0); // index into typeable segments
  const [typed, setTyped] = useState('');
  const inputRef = useRef(null);
  const doneRef = useRef(null);
  const currentRef = useRef(null);
  const activeTransRef = useRef(null);
  const jpPaneRef = useRef(null);
  const zhPaneRef = useRef(null);

  const passage = useMemo(() => {
    if (!passages?.length) return null;
    return passages.find((item) => item.id === passageId) ?? passages[0];
  }, [passages, passageId]);

  const model = useMemo(() => (passage ? buildPassageTyping(passage) : null), [passage]);

  // Map each segment to its ordinal among the typeable (keystroke-carrying) ones.
  const orderByIndex = useMemo(() => {
    const map = new Map();
    model?.typeable.forEach((segment, ordinal) => map.set(segment.index, ordinal));
    return map;
  }, [model]);

  const typeableCount = model?.typeable.length ?? 0;
  const complete = typeableCount > 0 && pos >= typeableCount;
  const currentSeg = complete ? null : model?.typeable[pos];
  const match = currentSeg ? matchSegment(typed, currentSeg) : null;

  useEffect(() => {
    setPos(0);
    setTyped('');
  }, [passage?.id]);

  useEffect(() => {
    if (complete) doneRef.current?.focus();
    else inputRef.current?.focus();
  }, [passage?.id, complete]);

  // Scroll one pane so a child is visible, centring it only when it has drifted
  // out of view. Touches the pane's own scrollTop rather than using
  // scrollIntoView, which would also drag the page around it.
  const scrollIntoPane = (pane, target) => {
    if (!pane || !target) return;
    const paneBox = pane.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    if (targetBox.top < paneBox.top || targetBox.bottom > paneBox.bottom) {
      pane.scrollTop +=
        targetBox.top - paneBox.top - pane.clientHeight / 2 + targetBox.height / 2;
    }
  };

  // Move both panes in unison as the cursor advances: the Japanese pane follows
  // the active word, the translation pane follows the span it maps to. When the
  // current segment has no correspondent (a particle), the translation pane has
  // no anchor and simply holds its position instead of jumping.
  useEffect(() => {
    scrollIntoPane(jpPaneRef.current, currentRef.current);
    scrollIntoPane(zhPaneRef.current, activeTransRef.current);
  }, [pos, passage?.id]);

  if (error) {
    return <div className="reading-view reading-empty">短文加载失败：{error}</div>;
  }
  if (!passages) {
    return <div className="reading-view reading-empty">正在加载短文…</div>;
  }
  if (!passage) {
    return <div className="reading-view reading-empty">暂无短文。</div>;
  }

  const handleChange = (value) => {
    if (!currentSeg) return;
    const next = matchSegment(value, currentSeg);
    if (next.complete) {
      setPos((previous) => previous + 1);
      setTyped('');
    } else {
      setTyped(value);
    }
  };

  const goToPassage = (id) => {
    setPassageId(id);
  };

  const restart = () => {
    setPos(0);
    setTyped('');
  };

  const currentIndex = passages.findIndex((item) => item.id === passage.id);
  const nextPassage = passages[(currentIndex + 1) % passages.length];
  const hasNext = passages.length > 1;

  const transIndices =
    currentSeg && Array.isArray(currentSeg.trans) ? currentSeg.trans : [];
  const activeTrans = new Set(transIndices);
  // The earliest highlighted token is what the translation pane scrolls to.
  const transAnchor = transIndices.length ? Math.min(...transIndices) : null;

  const segState = (segment) => {
    if (!segment.romaji) return 'punct';
    if (complete) return 'done';
    const ordinal = orderByIndex.get(segment.index);
    if (ordinal < pos) return 'done';
    if (ordinal === pos) return 'current';
    return 'pending';
  };

  const separator = passage.lang === 'en' ? ' ' : '';
  const donePercent = typeableCount ? Math.round((pos / typeableCount) * 100) : 0;

  return (
    <section className="reading-view">
      <header className="reading-header">
        <div className="reading-title">
          <div className="reading-eyebrow">
            <span>読解</span>
            <i />
            <span>跟打阅读</span>
          </div>
          <div className="reading-title-row">
            <span className={`level-chip level-${passage.level.toLowerCase()}`}>
              {passage.level}
            </span>
            <h1>{passage.title}</h1>
            <button
              aria-label={`播放 ${passage.title} 的读音`}
              className="icon-button"
              onClick={() => onSpeak?.(passage.segments.map((s) => s.surface).join(''))}
              title="朗读全文"
              type="button"
            >
              <Volume2 size={19} />
            </button>
          </div>
        </div>
        <label className="reading-picker">
          <span>短文</span>
          <select
            className="reading-select"
            onChange={(event) => goToPassage(event.target.value)}
            value={passage.id}
          >
            {passages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.level} · {item.title}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="reading-progress-row">
        <span>已读 {complete ? typeableCount : pos} / {typeableCount} 词</span>
        <div className="reading-progress-track" aria-label={`阅读进度 ${donePercent}%`}>
          <span style={{ width: `${complete ? 100 : donePercent}%` }} />
        </div>
      </div>

      <div className="reading-panes">
        <div className="reading-pane reading-pane-jp" ref={jpPaneRef}>
          <div className="reading-passage japanese-text" aria-label="日文短文">
            {model.segments.map((segment) => {
              if (segment.pos === 'break') {
                return <span aria-hidden="true" className="reading-break" key={segment.index} />;
              }
              const state = segState(segment);
              const isCurrent = state === 'current';
              let className = `reading-seg ${state}`;
              if (isCurrent) {
                className =
                  segment.kind === 'punct'
                    ? 'reading-seg current punct-current'
                    : `reading-seg current${segment.trans == null ? ' no-trans' : ''}`;
              }
              return (
                <span
                  className={className}
                  key={segment.index}
                  ref={isCurrent ? currentRef : null}
                >
                  {segment.surface}
                </span>
              );
            })}
          </div>
        </div>

        <div className="reading-pane reading-pane-zh" ref={zhPaneRef}>
          <p className="reading-translation" aria-label="对照翻译">
            {passage.translation.map((token, index) => (
              <span
                className={
                  activeTrans.has(index) ? 'reading-trans-token active' : 'reading-trans-token'
                }
                key={`${token}-${index}`}
                ref={index === transAnchor ? activeTransRef : null}
              >
                {token}
                {separator}
              </span>
            ))}
          </p>
        </div>
      </div>

      {complete ? (
        <div className="reading-done">
          <div className="reading-done-heading">
            <strong>読み終わりました</strong>
            <span>全文跟打完成</span>
          </div>
          <div className="reading-done-actions">
            <button className="button secondary" onClick={restart} type="button">
              <RotateCcw size={18} />
              再读一遍
            </button>
            {hasNext && (
              <button
                className="button primary"
                onClick={() => goToPassage(nextPassage.id)}
                ref={doneRef}
                type="button"
              >
                下一篇
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <section className="reading-type">
          <CurrentGuide match={match} segment={currentSeg} />
          <input
            aria-label="跟打输入"
            autoComplete="off"
            autoCorrect="off"
            className={match.wrong ? 'wrong' : ''}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="romaji"
            ref={inputRef}
            spellCheck="false"
            type="text"
            value={typed}
          />
          <p className="reading-hint">
            跟着假名输入 romaji，光标随你移动；当前词与对应的中文同时高亮。助词等无对应译文时高亮变色。
          </p>
        </section>
      )}
    </section>
  );
}
