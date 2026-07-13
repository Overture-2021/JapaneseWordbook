import {
  CloudDownload,
  CloudCog,
  CloudUpload,
  ExternalLink,
  GitBranch,
  KeyRound,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function CloudSyncDialog({
  open,
  onClose,
  connection,
  lastProfile,
  busy,
  error,
  onConnect,
  onDisconnect,
  onUpload,
  onDownload,
  autoSync,
  onAutoSync,
}) {
  const [token, setToken] = useState('');
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

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (token.trim()) onConnect(token.trim());
  };

  return (
    <div className="dialog-layer centered" role="presentation">
      <button
        aria-label="关闭云端同步"
        className="dialog-backdrop"
        onClick={onClose}
        tabIndex="-1"
        type="button"
      />
      <section
        aria-labelledby="cloud-title"
        aria-modal="true"
        className="cloud-dialog"
        role="dialog"
      >
        <header className="cloud-header">
          <div className="cloud-title-icon">
            <CloudCog size={24} />
          </div>
          <div>
            <span>GITHUB SYNC</span>
            <h2 id="cloud-title">云端同步</h2>
          </div>
          <button
            aria-label="关闭云端同步"
            className="icon-button"
            onClick={onClose}
            ref={closeRef}
            title="关闭"
            type="button"
          >
            <X size={21} />
          </button>
        </header>

        {!connection ? (
          <form className="cloud-connect-form" onSubmit={handleSubmit}>
            <div className="repo-target">
              <CloudCog size={19} />
              <div>
                <span>同步仓库</span>
                <strong>Overture-2021 / JapaneseWordbook</strong>
              </div>
              <span className="branch-badge">
                <GitBranch size={13} /> main
              </span>
            </div>

            <label className="token-field">
              <span>Fine-grained access token</span>
              <div>
                <KeyRound size={18} />
                <input
                  autoComplete="off"
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="github_pat_…"
                  type="password"
                  value={token}
                />
              </div>
            </label>

            <div className="security-note">
              <ShieldCheck size={18} />
              <span>Contents: Read and write · token 仅保留在当前标签页</span>
            </div>

            {lastProfile && (
              <p className="last-sync-profile">上次连接：@{lastProfile.username}</p>
            )}

            {error && <div className="cloud-error">{error}</div>}

            <div className="cloud-connect-actions">
              <a
                className="text-link"
                href="https://github.com/settings/personal-access-tokens/new"
                rel="noreferrer"
                target="_blank"
              >
                创建 token
                <ExternalLink size={14} />
              </a>
              <button
                className="button primary"
                disabled={busy || !token.trim()}
                type="submit"
              >
                {busy ? <LoaderCircle className="spin" size={18} /> : <CloudCog size={18} />}
                连接 GitHub
              </button>
            </div>
          </form>
        ) : (
          <div className="cloud-connected">
            <div className="github-profile">
              <img src={connection.user.avatar_url} alt="" />
              <div>
                <span>已连接</span>
                <strong>@{connection.user.login}</strong>
              </div>
              <button
                aria-label="断开 GitHub"
                className="icon-button"
                onClick={onDisconnect}
                title="断开连接"
                type="button"
              >
                <LogOut size={18} />
              </button>
            </div>

            <div className="cloud-status-grid">
              <div>
                <span>云端文件</span>
                <strong>user-data/{connection.user.login}.json</strong>
              </div>
              <div>
                <span>最后更新</span>
                <strong>
                  {connection.remote?.state?.updatedAt
                    ? new Intl.DateTimeFormat('zh-CN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(connection.remote.state.updatedAt))
                    : '尚未同步'}
                </strong>
              </div>
            </div>

            <label className="auto-sync-row">
              <span>
                <strong>批次完成后同步</strong>
                <small>每个批次创建一次数据提交</small>
              </span>
              <button
                aria-checked={autoSync}
                className={`switch ${autoSync ? 'on' : ''}`}
                onClick={() => onAutoSync(!autoSync)}
                role="switch"
                type="button"
              >
                <i />
              </button>
            </label>

            <div className="public-data-note">
              此仓库为公开仓库，同步的学习记录与偏好也将公开。
            </div>

            {error && <div className="cloud-error">{error}</div>}

            <div className="cloud-sync-actions">
              <button
                className="button secondary"
                disabled={busy || !connection.remote}
                onClick={onDownload}
                type="button"
              >
                <CloudDownload size={18} />
                从云端载入
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={onUpload}
                type="button"
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <CloudUpload size={18} />
                )}
                立即同步
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
