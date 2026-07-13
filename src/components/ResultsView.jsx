import { ArrowRight, Check, RefreshCw, RotateCcw, X } from 'lucide-react';
import { getSessionScore } from '../lib/session';
import { getWordForms } from '../lib/typing';

export function ResultsView({ mode, results, wordsById, onRepeat, onNewBatch }) {
  const score = getSessionScore(results);
  const correctCount = results.filter((result) => result.correct).length;
  const mistakes = results.filter((result) => !result.correct);
  const isRecite = mode === 'recite';

  return (
    <section className="results-view">
      <div className="results-topline">
        <span>{isRecite ? '背诵完成' : '测试完成'}</span>
        <span className="japanese-text">おつかれさま</span>
      </div>

      <div className="score-summary">
        <div className={`score-stamp score-${Math.floor(score / 10)}`}>
          <strong>{score}</strong>
          <span>{isRecite ? '记住率' : '正确率'}</span>
        </div>
        <div className="score-copy">
          <h2>{score >= 80 ? '稳步掌握' : score >= 60 ? '继续巩固' : '集中复习'}</h2>
          <p>
            {correctCount} / {results.length} {isRecite ? '已记住' : '题正确'}
          </p>
          <div className="score-meter" aria-label={`得分 ${score}%`}>
            <span style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>

      <div className="result-actions">
        {mistakes.length > 0 && (
          <button className="button secondary" onClick={onRepeat} type="button">
            <RotateCcw size={18} />
            复习错词 ({mistakes.length})
          </button>
        )}
        <button className="button primary" onClick={onNewBatch} type="button">
          <RefreshCw size={18} />
          新批次
        </button>
      </div>

      <section className="result-list-section">
        <div className="result-list-heading">
          <h3>本批词汇</h3>
          <span>{results.length} 词</span>
        </div>
        <div className="result-list">
          {results.map((result, index) => {
            const word = wordsById[result.wordId];
            if (!word) return null;
            const forms = getWordForms(word);
            return (
              <div className="result-row" key={`${result.wordId}-${index}`}>
                <span className={result.correct ? 'result-ok' : 'result-miss'}>
                  {result.correct ? <Check size={16} /> : <X size={16} />}
                </span>
                <div className="result-word">
                  <strong className="japanese-text">{word.term}</strong>
                  <span className="japanese-text">{word.reading}</span>
                </div>
                <span className="result-romaji">{forms.romaji}</span>
                <span className="result-meaning">{word.meaning}</span>
                {!result.correct && result.answer && (
                  <span className="result-user-answer">
                    {result.answer}
                    <ArrowRight size={13} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
