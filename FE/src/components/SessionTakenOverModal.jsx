import { useNavigate } from 'react-router-dom';
import { SESSION_LOGGED_OUT_EVENT } from '../services/httpClient';
import './LoginChallengeModal.css';

/**
 * Popup khi thiết bị khác đã đăng nhập cùng tài khoản (force takeover).
 */
export default function SessionTakenOverModal({ detail, onClose }) {
  const navigate = useNavigate();
  const device =
    detail?.device
    || [detail?.metadata?.browser, detail?.metadata?.os].filter(Boolean).join(' · ')
    || 'Thiết bị khác';
  const ip = detail?.ip || detail?.metadata?.ip;
  const message =
    detail?.message
    || 'Đã có người đăng nhập tài khoản của bạn. Phiên này sẽ bị đăng xuất.';

  function goLogin() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('permissions');
    window.dispatchEvent(new CustomEvent(SESSION_LOGGED_OUT_EVENT));
    onClose?.();
    navigate('/login', { replace: true });
  }

  return (
    <div className="login-challenge-overlay" role="alertdialog" aria-modal="true">
      <div className="login-challenge-modal">
        <div className="login-challenge-modal__banner">Cảnh báo bảo mật</div>
        <div className="login-challenge-modal__icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="login-challenge-modal__title">
          {detail?.title || 'Đã có người đăng nhập tài khoản của bạn'}
        </h2>
        <p className="login-challenge-modal__message">
          {message}
          <br />
          Thiết bị: <strong>{device}</strong>
          {ip ? <> · IP <strong>{ip}</strong></> : null}
        </p>
        <div className="login-challenge-modal__actions">
          <button
            type="button"
            className="login-challenge-btn login-challenge-btn--approve"
            onClick={goLogin}
          >
            Đăng nhập lại
          </button>
        </div>
      </div>
    </div>
  );
}
