import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BASE_PATH } from '../config';
import './SessionTakenOverPrompt.css';

export const SESSION_TAKEN_OVER_PROMPT_KEY = 'SESSION_TAKEN_OVER_PROMPT';
const LOGIN_PATH = `${BASE_PATH}/login`;

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
 * Popup bảo mật khi bấm thông báo (admin):
 * session_takeover / new_device → quên mật khẩu / xem thiết bị (không còn tin cậy thiết bị).
 */
export default function SessionTakenOverPrompt() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (window.location.pathname === LOGIN_PATH) return;
      setDetail(e?.detail || {});
      setVisible(true);
    };
    window.addEventListener(SESSION_TAKEN_OVER_PROMPT_KEY, handler);
    return () => window.removeEventListener(SESSION_TAKEN_OVER_PROMPT_KEY, handler);
  }, []);

  function close() {
    setVisible(false);
    setDetail(null);
  }

  function openForgotPassword() {
    close();
    navigate('/forgot-password');
  }

  function openDevices() {
    const meta = parseMeta(detail?.metadata);
    const params = new URLSearchParams();
    const ip = detail?.ip || meta.ip || meta.ipAddress || meta.location;
    if (ip) params.set('ip', String(ip));
    const qs = params.toString();
    close();
    navigate(qs ? `/admin/login-security?${qs}` : '/admin/login-security');
  }

  if (!visible) return null;

  const variant = detail?.variant === 'new_device' ? 'new_device' : 'session_takeover';
  const meta = parseMeta(detail?.metadata);
  const ip = detail?.ip || meta.ip || meta.ipAddress || meta.location || '';
  const browser = detail?.browser || meta.browser || '';
  const os = detail?.os || meta.os || '';
  const device = detail?.device
    || [browser, os].filter(Boolean).join(' · ')
    || (variant === 'new_device' ? 'Thiết bị mới' : 'Thiết bị khác');
  const when = formatWhen(detail?.createdAt || meta.timestamp || meta.loginTime);
  const showDevicesBtn = Boolean(detail?.canOpenDevices);

  const title = variant === 'new_device'
    ? 'Đăng nhập từ thiết bị mới'
    : 'Tài khoản của bạn đang login ở nơi khác';
  const lead = variant === 'new_device'
    ? 'Phát hiện đăng nhập từ thiết bị hoặc IP chưa từng dùng. Nếu không phải bạn, hãy đặt lại mật khẩu qua email.'
    : 'Ai đó vừa đăng nhập tài khoản của bạn từ thiết bị khác. Nếu không phải bạn, hãy đặt lại mật khẩu qua email (OTP).';

  return (
    <div
      className="sto-prompt-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="presentation"
    >
      <div className="sto-prompt" role="dialog" aria-modal="true" aria-labelledby="sto-prompt-title">
        <button type="button" className="sto-prompt__close" onClick={close} aria-label="Đóng">
          ×
        </button>

        <div className="sto-prompt__badge" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 id="sto-prompt-title" className="sto-prompt__title">
          {title}
        </h2>
        <p className="sto-prompt__lead">{lead}</p>

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
          <h3>Đặt lại mật khẩu qua email</h3>
          <p>
            Nếu không phải bạn, dùng Quên mật khẩu để xác nhận qua email.
            Có thể xem danh sách thiết bị và đăng xuất máy đáng ngờ.
          </p>
        </div>

        <div className="sto-prompt__actions">
          <button
            type="button"
            className="sto-prompt__btn sto-prompt__btn--primary"
            onClick={openForgotPassword}
          >
            Quên mật khẩu
          </button>
          {showDevicesBtn && (
            <button
              type="button"
              className="sto-prompt__btn sto-prompt__btn--secondary"
              onClick={openDevices}
            >
              Xem thiết bị
            </button>
          )}
          <button
            type="button"
            className="sto-prompt__btn sto-prompt__btn--ghost"
            onClick={close}
          >
            Lúc khác
          </button>
        </div>
      </div>
    </div>
  );
}
