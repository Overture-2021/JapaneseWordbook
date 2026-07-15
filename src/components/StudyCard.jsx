import { useEffect, useMemo, useRef } from 'react';
import {
  ArrowRight,
  Check,
  Delete,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import {
  classifyScript,
  getKanaPreview,
  getWordForms,
  keystrokeGroups,
  splitKeystrokes,
} from '../lib/typing';

const keyboardRows = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '-'],
];

function SpeakButton({ word, onSpeak, disabled = false }) {
  return (
    <button
      aria-label={`播放 ${word.term} 的读音`}
      className="icon-button"
      disabled={disabled}
      onClick={() => onSpeak(word)}
      title="播放读音"
      type="button"
    >
      <Volume2 size={19} />
    </button>
  );
}

function MetaRow({ word, onSpeak, speakDisabled }) {
  return (
    <div className="card-meta-row">
      <div className="word-tags">
        <span className={`level-chip level-${word.level.toLowerCase()}`}>
          {word.level}
        </span>
        <span>{word.partOfSpeech}</span>
        <span>{classifyScript(word.term)}</span>
      </div>
      <SpeakButton
        disabled={speakDisabled}
        onSpeak={onSpeak}
        word={word}
      />
    </div>
  );
}

function KeystrokeGuide({ word, typed = '' }) {
  const keys = splitKeystrokes(word.reading);
  const cleanTyped = typed.toLowerCase().replace(/[^a-z-]/g, '');
  const groups = keystrokeGroups(word);

  const renderKey = (index) => (
    <kbd
      className={
        index < cleanTyped.length
          ? cleanTyped[index] === keys[index]
            ? 'done'
            : 'wrong'
          : index === cleanTyped.length
            ? 'current'
            : ''
      }
      key={`${keys[index]}-${index}`}
    >
      {keys[index]}
    </kbd>
  );

  if (!groups) {
    return (
      <div className="keystroke-guide" aria-label={`键盘输入 ${keys.join('')}`}>
        {keys.map((key, index) => renderKey(index))}
      </div>
    );
  }

  return (
    <div className="keystroke-guide grouped" aria-label={`键盘输入 ${keys.join('')}`}>
      {groups.map((group, groupIndex) => (
        <div className="keystroke-group" key={`${group.label}-${groupIndex}`}>
          <span className="keystroke-group-label japanese-text">{group.label}</span>
          <div className="keystroke-group-keys">
            {keys
              .slice(group.start, group.end)
              .map((key, offset) => renderKey(group.start + offset))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QwertyKeyboard({ activeKey, onKey, onBackspace }) {
  return (
    <div className="keyboard-visual" aria-label="罗马字键盘">
      {keyboardRows.map((row, rowIndex) => (
        <div className="keyboard-row" key={row.join('')}>
          {row.map((key) => (
            <button
              className={activeKey === key ? 'active' : ''}
              key={key}
              onClick={() => onKey(key)}
              tabIndex="-1"
              type="button"
            >
              {key.toUpperCase()}
            </button>
          ))}
          {rowIndex === 2 && (
            <button
              aria-label="退格"
              className="backspace-key"
              onClick={onBackspace}
              tabIndex="-1"
              title="退格"
              type="button"
            >
              <Delete size={17} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReciteCard({ word, typed, onTyped, onChoice, onSpeak, onPrev, onNext }) {
  const inputRef = useRef(null);
  const forms = useMemo(() => getWordForms(word), [word]);
  const cleanTyped = typed.toLowerCase().replace(/[^a-z-]/g, '');
  const typingWrong = cleanTyped && !forms.romaji.startsWith(cleanTyped);
  const typingComplete = cleanTyped === forms.romaji;
  const activeKey = typingWrong ? null : forms.romaji[cleanTyped.length];

  useEffect(() => {
    inputRef.current?.focus();
  }, [word.id]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onChoice(true);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNext();
    }
  };

  return (
    <article className="study-card recite-card">
      <MetaRow onSpeak={onSpeak} word={word} />

      <div className="recite-word-block">
        <div className="display-word japanese-text">{word.term}</div>
        <div className="meaning-line">{word.meaning}</div>
      </div>

      <div className="forms-grid">
        <div>
          <span>ひらがな</span>
          <strong className="japanese-text">{forms.hiragana}</strong>
        </div>
        <div>
          <span>カタカナ</span>
          <strong className="japanese-text">{forms.katakana}</strong>
        </div>
        <div className="romaji-form">
          <span>ROMAJI</span>
          <strong>{forms.romaji}</strong>
        </div>
      </div>

      <section className="typing-practice">
        <div className="section-label-row">
          <label htmlFor="follow-type">键盘跟打</label>
          <span className={typingWrong ? 'error-text' : typingComplete ? 'success-text' : ''}>
            {typingWrong ? '检查按键' : typingComplete ? '输入完成' : getKanaPreview(typed) || 'かな'}
          </span>
        </div>
        <KeystrokeGuide word={word} typed={typed} />
        <input
          autoComplete="off"
          autoCorrect="off"
          className={typingWrong ? 'wrong' : typingComplete ? 'complete' : ''}
          id="follow-type"
          onChange={(event) => onTyped(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="romaji"
          ref={inputRef}
          spellCheck="false"
          type="text"
          value={typed}
        />
        <QwertyKeyboard
          activeKey={activeKey}
          onBackspace={() => onTyped(typed.slice(0, -1))}
          onKey={(key) => onTyped(`${typed}${key}`)}
        />
      </section>

      <div className="card-actions split-actions">
        <button
          className="button secondary"
          onClick={() => onChoice(false)}
          type="button"
        >
          <RotateCcw size={18} />
          再看
        </button>
        <button
          className="button primary"
          onClick={() => onChoice(true)}
          type="button"
        >
          <Check size={18} />
          下一个
        </button>
      </div>
    </article>
  );
}

export function TestCard({
  mode,
  word,
  answer,
  onAnswer,
  onSubmit,
  onAdvance,
  onSpeak,
  result,
}) {
  const inputRef = useRef(null);
  const advanceRef = useRef(null);
  const forms = useMemo(() => getWordForms(word), [word]);
  const submitted = Boolean(result);
  const isRead = mode === 'read';

  useEffect(() => {
    // Keyboard-first: put focus where the next keystroke is expected — the
    // answer box before submitting, the advance button after (Enter advances).
    if (submitted) advanceRef.current?.focus();
    else inputRef.current?.focus();
  }, [word.id, submitted]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (submitted) onAdvance();
    else if (answer.trim()) onSubmit();
  };

  return (
    <article className={`study-card test-card ${submitted ? 'show-feedback' : ''}`}>
      <MetaRow
        onSpeak={onSpeak}
        speakDisabled={!submitted}
        word={word}
      />

      <div className={`test-prompt ${isRead ? 'japanese-prompt' : 'chinese-prompt'}`}>
        <span>{isRead ? '日 → 音' : '中 → 日'}</span>
        <div className={isRead ? 'japanese-text' : ''}>
          {isRead ? word.term : word.meaning}
        </div>
      </div>

      <div className="answer-area">
        <label htmlFor="test-answer">
          {isRead ? '输入读音' : '输入日语'}
        </label>
        <div className="answer-input-wrap">
          <input
            aria-describedby="kana-preview"
            autoComplete="off"
            autoCorrect="off"
            className={
              submitted ? (result.correct ? 'answer-correct' : 'answer-wrong') : ''
            }
            disabled={submitted}
            id="test-answer"
            onChange={(event) => onAnswer(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="romaji / かな / 日本語"
            ref={inputRef}
            spellCheck="false"
            type="text"
            value={answer}
          />
          {!submitted && (
            <button
              aria-label="确认答案"
              disabled={!answer.trim()}
              onClick={onSubmit}
              title="确认"
              type="button"
            >
              <ArrowRight size={20} />
            </button>
          )}
        </div>
        <div className="kana-preview" id="kana-preview">
          <span>かな</span>
          <strong className="japanese-text">{getKanaPreview(answer) || '—'}</strong>
        </div>
      </div>

      {submitted && (
        <section
          aria-live="polite"
          className={`answer-feedback ${result.correct ? 'correct' : 'incorrect'}`}
        >
          <div className="feedback-heading">
            <span className="feedback-icon">
              {result.correct ? <Check size={20} /> : <X size={20} />}
            </span>
            <div>
              <strong>{result.correct ? '正确' : '再记一次'}</strong>
              {!result.correct && <span>你的答案：{result.answer || '—'}</span>}
            </div>
          </div>
          <div className="feedback-answer">
            <strong className="japanese-text">{word.term}</strong>
            <span className="japanese-text">{forms.hiragana}</span>
            <span>{forms.romaji}</span>
            <span>{word.meaning}</span>
          </div>
        </section>
      )}

      <div className="card-actions">
        {submitted ? (
          <button
            className="button primary wide"
            onClick={onAdvance}
            ref={advanceRef}
            type="button"
          >
            下一题
            <ArrowRight size={18} />
          </button>
        ) : (
          <button
            className="button primary wide"
            disabled={!answer.trim()}
            onClick={onSubmit}
            type="button"
          >
            确认
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </article>
  );
}
