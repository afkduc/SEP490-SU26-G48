import { useState, useCallback, useMemo } from 'react';
import { adminUsersApi } from '../../../services/adminApi';
import { isValidPassword } from '../../../utils/validation';
import './ResetPasswordModal.css';

const PASSWORD_MIN_LENGTH = 6;

function PasswordEyeToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      className="reset-pw-eye-btn"
      onClick={onToggle}
      aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
    >
      {show ? (
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
  );
}

/**
 * Modal "Đặt lại mật khẩu" cho admin.
 *   - 'random': BE sinh MK ngẫu nhiên
 *   - 'manual': admin nhập MK (>=6, có chữ và số) + xác nhận
 */
export default function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [phase, setPhase] = useState('confirm');
  const [mode, setMode] = useState('random');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const manualError = useMemo(() => {
    if (mode !== 'manual') return null;
    if (!newPassword) return 'Mật khẩu mới là bắt buộc';
    if (!isValidPassword(newPassword, PASSWORD_MIN_LENGTH)) {
      return `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`;
    }
    if (newPassword !== confirmPassword) return 'Mật khẩu xác nhận không khớp';
    return null;
  }, [mode, newPassword, confirmPassword]);

  const handleSubmit = useCallback(async () => {
    if (!user?.id) return;
    if (mode === 'manual' && manualError) return;

    setPhase('loading');
    setError(null);
    try {
      const payload = mode === 'manual' ? { newPassword } : {};
      const res = await adminUsersApi.resetPassword(user.id, payload);
      setResult(res);
      setPhase('result');
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Đặt lại mật khẩu thất bại');
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

  if (phase === 'loading') {
    return (
      <div className="reset-pw-overlay" onClick={onClose}>
        <div className="reset-pw-modal" onClick={(e) => e.stopPropagation()}>
          <div className="reset-pw-loading">
            <div className="spinner" />
            <span>Đang đặt lại mật khẩu...</span>
          </div>
        </div>
      </div>
    );
  }

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
              <h2 className="reset-pw-header__title">Đặt lại mật khẩu thành công</h2>
              <p className="reset-pw-header__sub">
                Mật khẩu mới cho <strong>{user?.name || user?.email}</strong>
              </p>
            </div>
            <button type="button" className="reset-pw-close" onClick={handleClose}>×</button>
          </div>

          <div className="reset-pw-body">
            {isManual ? (
              <div className="reset-pw-info-box">
                <p>
                  Mật khẩu mới đã được đặt theo giá trị bạn nhập. Hãy đảm bảo
                  người dùng <strong>{user?.name || user?.email}</strong> được thông báo
                  để sử dụng mật khẩu mới ở lần đăng nhập tiếp theo.
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
                    Mật khẩu chỉ hiển thị <strong>1 lần</strong>. Hãy sao chép và gửi cho người dùng
                    qua kênh an toàn để dùng ở lần đăng nhập tiếp theo.
                  </span>
                </div>

                <div className="reset-pw-password-box">
                  <label className="reset-pw-password-label">Mật khẩu mới</label>
                  <div className="reset-pw-password-row">
                    <code className="reset-pw-password-value">{result.newPassword}</code>
                    <button className="reset-pw-copy-btn" onClick={handleCopy} type="button">
                      {copied ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Đã sao chép
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Sao chép
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
              <button type="button" className="reset-pw-btn reset-pw-btn--primary" onClick={handleClose}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <h2 className="reset-pw-header__title">Đặt lại mật khẩu</h2>
            <p className="reset-pw-header__sub">
              {user ? `${user.name || user.email}` : 'Người dùng'}
            </p>
          </div>
          <button type="button" className="reset-pw-close" onClick={handleClose}>×</button>
        </div>

        <div className="reset-pw-body">
          {phase === 'error' && error && <div className="reset-pw-error">{error}</div>}

          <div className="reset-pw-info">
            <p className="reset-pw-info__label">Người dùng</p>
            <p className="reset-pw-info__value">
              <strong>{user?.name || '—'}</strong>
              {user?.email && <span className="reset-pw-info__email">({user.email})</span>}
            </p>
          </div>

          <div className="reset-pw-mode-switcher" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'random'}
              className={`reset-pw-mode-tab ${mode === 'random' ? 'is-active' : ''}`}
              onClick={() => handleModeSwitch('random')}
            >
              Mật khẩu ngẫu nhiên
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              className={`reset-pw-mode-tab ${mode === 'manual' ? 'is-active' : ''}`}
              onClick={() => handleModeSwitch('manual')}
            >
              Nhập mật khẩu mới
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
                <li>Một mật khẩu mới sẽ được tạo tự động (gồm chữ hoa, chữ thường, số và ký tự đặc biệt).</li>
                <li>Mật khẩu chỉ được hiển thị <strong>1 lần</strong> sau khi đặt lại.</li>
                <li>Hãy gửi mật khẩu mới cho người dùng qua kênh an toàn.</li>
              </ul>
            </div>
          ) : (
            <div className="reset-pw-form">
              <div className="reset-pw-form-field">
                <label htmlFor="reset-pw-new">Mật khẩu mới</label>
                <div className="reset-pw-input-wrap">
                  <input
                    id="reset-pw-new"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`}
                    autoComplete="new-password"
                  />
                  <PasswordEyeToggle
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                </div>
              </div>

              <div className="reset-pw-form-field">
                <label htmlFor="reset-pw-confirm">Xác nhận mật khẩu</label>
                <div className="reset-pw-input-wrap">
                  <input
                    id="reset-pw-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    autoComplete="new-password"
                  />
                  <PasswordEyeToggle
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                </div>
              </div>

              {manualError && newPassword && (
                <p className="reset-pw-inline-error">{manualError}</p>
              )}

              <p className="reset-pw-form-hint">
                Mật khẩu tối thiểu {PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số.
                Hãy gửi mật khẩu mới cho người dùng qua kênh an toàn.
              </p>
            </div>
          )}
        </div>

        <div className="reset-pw-footer">
          <div className="reset-pw-footer__actions">
            <button type="button" className="reset-pw-btn reset-pw-btn--ghost" onClick={handleClose}>
              Hủy
            </button>
            <button
              type="button"
              className="reset-pw-btn reset-pw-btn--primary"
              onClick={handleSubmit}
              disabled={!user?.id || (mode === 'manual' && !!manualError)}
            >
              Đặt lại mật khẩu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
