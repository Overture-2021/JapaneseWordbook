import {
  BookMarked,
  BookOpen,
  Cloud,
  CloudOff,
  Keyboard,
  PenLine,
  ScrollText,
} from 'lucide-react';

const modes = [
  { id: 'recite', label: '背诵', japanese: '覚える', icon: BookMarked },
  { id: 'read', label: '认读测试', japanese: '読む', icon: Keyboard },
  { id: 'write', label: '默写测试', japanese: '書く', icon: PenLine },
  { id: 'reading', label: '阅读', japanese: '読解', icon: ScrollText },
];

export function Sidebar({
  activeMode,
  onModeChange,
  onOpenDictionary,
  onOpenCloud,
  todayStats,
  cloudConnected,
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          言
        </div>
        <div>
          <strong>言葉帳</strong>
          <span>KOTOBACHO</span>
        </div>
      </div>

      <nav className="mode-nav" aria-label="学习模式">
        <p className="nav-label">学习</p>
        {modes.map(({ id, label, japanese, icon: Icon }) => (
          <button
            className={`nav-item ${activeMode === id ? 'active' : ''}`}
            key={id}
            onClick={() => onModeChange(id)}
            type="button"
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>
              <strong>{label}</strong>
              <small>{japanese}</small>
            </span>
          </button>
        ))}

        <p className="nav-label nav-label-spaced">资料</p>
        <button className="nav-item" onClick={onOpenDictionary} type="button">
          <BookOpen size={19} strokeWidth={1.8} />
          <span>
            <strong>词库</strong>
            <small>辞書</small>
          </span>
        </button>
        <button className="nav-item" onClick={onOpenCloud} type="button">
          {cloudConnected ? (
            <Cloud size={19} strokeWidth={1.8} />
          ) : (
            <CloudOff size={19} strokeWidth={1.8} />
          )}
          <span>
            <strong>云端同步</strong>
            <small>{cloudConnected ? '已连接' : 'GitHub'}</small>
          </span>
          {cloudConnected && <i className="status-dot" aria-label="云端已连接" />}
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <section className="today-panel" aria-label="今日进度">
        <div className="today-heading">
          <span>今日</span>
          <span className="today-date">
            {new Intl.DateTimeFormat('zh-CN', {
              month: 'short',
              day: 'numeric',
            }).format(new Date())}
          </span>
        </div>
        <div className="today-numbers">
          <div>
            <strong>{todayStats.seen}</strong>
            <span>已练</span>
          </div>
          <div>
            <strong>{todayStats.accuracy}%</strong>
            <span>正确率</span>
          </div>
        </div>
      </section>

      <figure className="artwork-strip">
        <img
          src={`${import.meta.env.BASE_URL}assets/great-wave.jpg`}
          alt="葛饰北斋《神奈川冲浪里》局部"
        />
        <figcaption>葛饰北斋 · 1831</figcaption>
      </figure>
    </aside>
  );
}

export function MobileNav({ activeMode, onModeChange }) {
  return (
    <nav className="mobile-nav" aria-label="学习模式">
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          className={activeMode === id ? 'active' : ''}
          key={id}
          onClick={() => onModeChange(id)}
          type="button"
        >
          <Icon size={20} strokeWidth={1.9} />
          <span>{label.replace('测试', '')}</span>
        </button>
      ))}
    </nav>
  );
}
