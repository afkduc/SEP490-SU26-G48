import { useEffect, useState } from 'react';
import { changePassword } from '../services/profileApi';
import { useToast } from './common/ToastContext';
import './SessionTakenOverPrompt.css';

export const SESSION_TAKEN_OVER_PROMPT_KEY = 'SESSION_TAKEN_OVER_PROMPT';

export function dispatchSessionTakenOverPrompt(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_TAKEN_OVER_PROMPT_KEY, { detail: detail || {} }));
}

function parseMeta(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function formatWhen(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

/**
 * Popup kiểu Facebook khi user bấm thông báo SESSION_TAKEN_OVER:
 * — Text: tài khoản đang login ở nơi khác
 * — Đổi mật khẩu / Lúc khác
 */
export default function SessionTakenOverPrompt() {
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [step, setStep] = useState('info'); // info | password
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (window.location.pathname === '/login') return;
      setDetail(e?.detail || {});
      setStep('info');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setErrors({});
      setVisible(true);
    };
    window.addEventListener(SESSION_TAKEN_OVER_PROMPT_KEY, handler);
    return () => window.removeEventListener(SESSION_TAKEN_OVER_PROMPT_KEY, handler);
  }, []);

  function close() {
    setVisible(false);
    setDetail(null);
    setStep('info');
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!form.currentPassword) nextErrors.currentPassword = 'Nhập mật khẩu hiện tại';
    if (!form.newPassword) nextErrors.newPassword = 'Nhập mật khẩu mới';
    else if (form.newPassword.length < 6) nextErrors.newPassword = 'Mật khẩu mới tối thiểu 6 ký tự';
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Xác nhận mật khẩu mới';
    else if (form.newPassword !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Đã đổi mật khẩu. Các phiên khác sẽ không dùng được mật khẩu cũ.');
      close();
    } catch (err) {
      setErrors({ form: err?.message || 'Không thể đổi mật khẩu' });
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  const meta = parseMeta(detail?.metadata);
  const ip = detail?.ip || meta.ip || meta.ipAddress || meta.location || '';
  const browser = detail?.browser || meta.browser || '';
  const os = detail?.os || meta.os || '';
  const device = detail?.device
    || [browser, os].filter(Boolean).join(' · ')
    || 'Thiết bị khác';
  const when = formatWhen(detail?.createdAt || meta.timestamp || meta.loginTime);

  return (
    <div
      className="sto-prompt-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && step === 'info') close();
      }}
      role="presentation"
    >
      <div className="sto-prompt" role="dialog" aria-modal="true" aria-labelledby="sto-prompt-title">
        <button type="button" className="sto-prompt__close" onClick={close} aria-label="Đóng">
          ×
        </button>

        {step === 'info' ? (
          <>
            <div className="sto-prompt__badge" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h2 id="sto-prompt-title" className="sto-prompt__title">
              Tài khoản của bạn đang login ở nơi khác
            </h2>
            <p className="sto-prompt__lead">
              Ai đó vừa đăng nhập tài khoản của bạn từ thiết bị khác.
              Nếu không phải bạn, hãy đổi mật khẩu ngay.
            </p>

            <div className="sto-prompt__card">
              <div className="sto-prompt__card-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="sto-prompt__card-body">
                <strong>Lần đăng nhập từ {device}</strong>
                {ip && <span>IP {ip}</span>}
                {when && <span>{when}</span>}
              </div>
            </div>

            <div className="sto-prompt__recommend">
              <h3>Hãy đổi mật khẩu ngay</h3>
              <p>Ai đó đã dùng thông tin đăng nhập của bạn và có thể thử đăng nhập lại.</p>
            </div>

            <div className="sto-prompt__actions">
              <button
                type="button"
                className="sto-prompt__btn sto-prompt__btn--primary"
                onClick={() => setStep('password')}
              >
                Đổi mật khẩu
              </button>
              <button
                type="button"
                className="sto-prompt__btn sto-prompt__btn--ghost"
                onClick={close}
              >
                Lúc khác
              </button>
            </div>
          </>
        ) : (
          <form className="sto-prompt__form" onSubmit={handleChangePassword}>
            <h2 className="sto-prompt__title">Đổi mật khẩu</h2>
            <p className="sto-prompt__lead">
              Sau khi đổi, phiên đăng nhập ở thiết bị khác sẽ không còn hợp lệ với mật khẩu cũ.
            </p>

            {errors.form && <div className="sto-prompt__error">{errors.form}</div>}

            <label className="sto-prompt__field">
              <span>Mật khẩu hiện tại</span>
              <input
                type="password"
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              />
              {errors.currentPassword && <em>{errors.currentPassword}</em>}
            </label>
            <label className="sto-prompt__field">
              <span>Mật khẩu mới</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
              {errors.newPassword && <em>{errors.newPassword}</em>}
            </label>
            <label className="sto-prompt__field">
              <span>Xác nhận mật khẩu mới</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              />
              {errors.confirmPassword && <em>{errors.confirmPassword}</em>}
            </label>

            <div className="sto-prompt__actions">
              <button
                type="submit"
                className="sto-prompt__btn sto-prompt__btn--primary"
                disabled={saving}
              >
                {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
              <button
                type="button"
                className="sto-prompt__btn sto-prompt__btn--ghost"
                onClick={() => setStep('info')}
                disabled={saving}
              >
                Quay lại
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
