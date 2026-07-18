import { useState, useCallback, useMemo } from 'react';
import { adminUsersApi } from '../../../services/adminApi';
import './ResetPasswordModal.css';

const PASSWORD_MIN_LENGTH = 6;

/**
 * Modal "Dat lai mat khau" cho admin.
 * Co 2 che do:
 *   - 'random': BE sinh MK ngau nhien, modal hien thi MK cho admin copy
 *   - 'manual': admin nhap MK moi (>=6 ky tu) + xac nhan, modal chi bao thanh cong
 *
 * Flow 3 pha:
 *   - Pha 1 (confirm): chon mode + dien thong tin + canh bao
 *   - Pha 2 (loading): dang gui request
 *   - Pha 3 (result): hien thi MK (random) hoac thong bao (manual)
 *
 * Props:
 *   - user: { id, name, email } | null
 *   - onClose: () => void
 *   - onSuccess?: () => void
 */
export default function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [phase, setPhase] = useState('confirm'); // 'confirm' | 'loading' | 'result' | 'error'
  const [mode, setMode] = useState('random'); // 'random' | 'manual'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const manualError = useMemo(() => {
    if (mode !== 'manual') return null;
    if (!newPassword) return 'Mat khau moi la bat buoc';
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return `Mat khau phai co it nhat ${PASSWORD_MIN_LENGTH} ky tu`;
    }
    if (newPassword !== confirmPassword) return 'Mat khau xac nhan khong khop';
    return null;
  }, [mode, newPassword, confirmPassword]);

  const handleSubmit = useCallback(async () => {
    if (!user?.id) return;
    if (mode === 'manual' && manualError) return;

    setPhase('loading');
    setError(null);
    try {
      const payload =
        mode === 'manual'
          ? { mustChangePassword: true, newPassword }
          : { mustChangePassword: true };
      const res = await adminUsersApi.resetPassword(user.id, payload);
      setResult(res);
      setPhase('result');
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Dat lai mat khau that bai');
      setPhase('error');
    }
  }, [user, mode, newPassword, manualError, onSuccess]);

  const handleCopy = useCallback(async () => {
    if (!result?.newPassword) return;
    try {
      await navigator.clipboard.writeText(result.newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = result.newPassword;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
  }, [result]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleModeSwitch = useCallback((next) => {
    setMode(next);
    setError(null);
    if (next === 'random') {
      setNewPassword('');
      setConfirmPassword('');
    }
  }, []);

  // Loading
  if (phase === 'loading') {
    return (
      <div className="reset-pw-overlay" onClick={onClose}>
        <div className="reset-pw-modal" onClick={(e) => e.stopPropagation()}>
          <div className="reset-pw-loading">
            <div className="spinner" />
            <span>Dang dat lai mat khau...</span>
          </div>
        </div>
      </div>
    );
  }

  // Result
  if (phase === 'result' && result) {
    const isManual = result.isManual === true;
    return (
      <div className="reset-pw-overlay" onClick={onClose}>
        <div className="reset-pw-modal" onClick={(e) => e.stopPropagation()}>
          <div className="reset-pw-header">
            <div className="reset-pw-header__icon reset-pw-header__icon--success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <h2 className="reset-pw-header__title">Dat lai mat khau thanh cong</h2>
              <p className="reset-pw-header__sub">
                Mat khau moi cho <strong>{user?.name || user?.email}</strong>
              </p>
            </div>
            <button className="reset-pw-close" onClick={handleClose}>×</button>
          </div>

          <div className="reset-pw-body">
            {isManual ? (
              <div className="reset-pw-info-box">
                <p>
                  Mat khau moi da duoc dat theo gia tri ban nhap. Hay dam bao
                  nguoi dung <strong>{user?.name || user?.email}</strong> duoc thong bao
                  de su dung MK moi o lan dang nhap tiep theo.
                </p>
                {result.message && <p className="reset-pw-message">{result.message}</p>}
              </div>
            ) : (
              <>
                <div className="reset-pw-warning">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>
                    Mat khau chi hien thi <strong>1 lan</strong>. Hay copy va gui cho nguoi dung
                    qua kenh an toan. Nguoi dung se buoc phai doi mat khau o lan dang nhap tiep theo.
                  </span>
                </div>

                <div className="reset-pw-password-box">
                  <label className="reset-pw-password-label">Mat khau moi</label>
                  <div className="reset-pw-password-row">
                    <code className="reset-pw-password-value">{result.newPassword}</code>
                    <button
                      className="reset-pw-copy-btn"
                      onClick={handleCopy}
                      type="button"
                    >
                      {copied ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Da copy
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {result.message && <p className="reset-pw-message">{result.message}</p>}
              </>
            )}
          </div>

          <div className="reset-pw-footer">
            <div className="reset-pw-footer__actions">
              <button className="btn-cancel" onClick={handleClose}>Đóng</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Confirm / Error
  return (
    <div className="reset-pw-overlay" onClick={onClose}>
      <div className="reset-pw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reset-pw-header">
          <div className="reset-pw-header__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="reset-pw-header__title">Dat lai mat khau</h2>
            <p className="reset-pw-header__sub">
              {user ? `${user.name || user.email}` : 'Nguoi dung'}
            </p>
          </div>
          <button className="reset-pw-close" onClick={handleClose}>×</button>
        </div>

        <div className="reset-pw-body">
          {phase === 'error' && error && <div className="reset-pw-error">{error}</div>}

          <div className="reset-pw-info">
            <p className="reset-pw-info__label">Nguoi dung</p>
            <p className="reset-pw-info__value">
              <strong>{user?.name || '—'}</strong>
              {user?.email && <span className="reset-pw-info__email">({user.email})</span>}
            </p>
          </div>

          {/* Mode switcher */}
          <div className="reset-pw-mode-switcher" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'random'}
              className={`reset-pw-mode-tab ${mode === 'random' ? 'is-active' : ''}`}
              onClick={() => handleModeSwitch('random')}
            >
              Mat khau ngau nhien
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              className={`reset-pw-mode-tab ${mode === 'manual' ? 'is-active' : ''}`}
              onClick={() => handleModeSwitch('manual')}
            >
              Nhap mat khau moi
            </button>
          </div>

          {mode === 'random' ? (
            <div className="reset-pw-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <ul className="reset-pw-warning__list">
                <li>Mot mat khau moi se duoc tao tu dong (gom chu hoa, chu thuong, so va ky tu dac biet).</li>
                <li>Nguoi dung se <strong>buoc phai doi mat khau</strong> o lan dang nhap tiep theo.</li>
                <li>Mat khau chi duoc hien thi <strong>1 lan</strong> sau khi dat lai.</li>
              </ul>
            </div>
          ) : (
            <div className="reset-pw-form">
              <div className="reset-pw-form-field">
                <label htmlFor="reset-pw-new">Mat khau moi</label>
                <div className="reset-pw-input-wrap">
                  <input
                    id="reset-pw-new"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={`It nhat ${PASSWORD_MIN_LENGTH} ky tu`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="reset-pw-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'An mat khau' : 'Hien mat khau'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="reset-pw-form-field">
                <label htmlFor="reset-pw-confirm">Xac nhan mat khau</label>
                <div className="reset-pw-input-wrap">
                  <input
                    id="reset-pw-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhap lai mat khau moi"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {manualError && newPassword && (
                <p className="reset-pw-inline-error">{manualError}</p>
              )}

              <p className="reset-pw-form-hint">
                Mat khau phai co it nhat {PASSWORD_MIN_LENGTH} ky tu. Nguoi dung se
                <strong> buoc phai doi mat khau </strong>
                o lan dang nhap tiep theo.
              </p>
            </div>
          )}
        </div>

        <div className="reset-pw-footer">
          <div className="reset-pw-footer__actions">
            <button className="btn-cancel" onClick={handleClose}>Huy</button>
            <button
              className="btn-danger"
              onClick={handleSubmit}
              disabled={!user?.id || (mode === 'manual' && !!manualError)}
            >
              Dat lai mat khau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
