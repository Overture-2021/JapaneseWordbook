import { Minus, Plus, RefreshCw, Shuffle } from 'lucide-react';
import { JLPT_LEVELS, LEVEL_LABELS } from '../data/dictionary';

export function StudyToolbar({ settings, onChange, onNewBatch }) {
  const setBatchSize = (value) => {
    const numeric = Math.min(25, Math.max(1, Number(value) || 1));
    onChange({ ...settings, batchSize: numeric });
  };

  return (
    <section className="study-toolbar" aria-label="批次设置">
      <div className="level-picker">
        <span className="control-label">JLPT</span>
        <div className="segmented-control">
          {JLPT_LEVELS.map((level) => (
            <button
              aria-label={`${level} ${LEVEL_LABELS[level]}`}
              aria-pressed={settings.level === level}
              className={settings.level === level ? 'active' : ''}
              key={level}
              onClick={() => onChange({ ...settings, level })}
              title={LEVEL_LABELS[level]}
              type="button"
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="batch-stepper">
        <span className="control-label">每批</span>
        <div className="stepper-control">
          <button
            aria-label="减少批次词数"
            disabled={settings.batchSize <= 1}
            onClick={() => setBatchSize(settings.batchSize - 1)}
            title="减少"
            type="button"
          >
            <Minus size={15} />
          </button>
          <input
            aria-label="每批词数"
            inputMode="numeric"
            max="25"
            min="1"
            onChange={(event) => setBatchSize(event.target.value)}
            type="number"
            value={settings.batchSize}
          />
          <button
            aria-label="增加批次词数"
            disabled={settings.batchSize >= 25}
            onClick={() => setBatchSize(settings.batchSize + 1)}
            title="增加"
            type="button"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <button
        aria-pressed={settings.shuffle}
        className={`shuffle-toggle ${settings.shuffle ? 'active' : ''}`}
        onClick={() => onChange({ ...settings, shuffle: !settings.shuffle })}
        title="随机顺序"
        type="button"
      >
        <Shuffle size={16} />
        <span>随机</span>
        <i aria-hidden="true" />
      </button>

      <button className="new-batch-button" onClick={onNewBatch} type="button">
        <RefreshCw size={16} />
        <span>新批次</span>
      </button>
    </section>
  );
}
