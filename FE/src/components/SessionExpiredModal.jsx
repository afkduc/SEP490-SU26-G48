import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SESSION_EXPIRED_KEY, SESSION_LOGGED_OUT_EVENT } from '../services/httpClient';
import { useAuth } from '../contexts/AppContext';
import { BASE_PATH } from '../config';

const LOGIN_PATH = `${BASE_PATH}/login`;

// Module-level flag da chong spam DUNG ROI giua cac instance StrictMode/HMR.
let modalShownAt = 0;
const MIN_REDISPLAY_INTERVAL_MS = 60_000;

export default function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const handler = (event) => {
      if (window.location.pathname === LOGIN_PATH) return;
      const now = Date.now();
      if (now - modalShownAt < MIN_REDISPLAY_INTERVAL_MS) {
        return;
      }
      modalShownAt = now;
      setDetail(event?.detail || null);
      setVisible(true);
    };
    window.addEventListener(SESSION_EXPIRED_KEY, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_KEY, handler);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'token' && e.newValue) {
        modalShownAt = 0;
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  async function handleLogin() {
    modalShownAt = 0;
    setVisible(false);
    setDetail(null);
    try {
      // Dung logout trung tam de bao dam clear state + cancel request + redirect.
      await logout();
    } catch {
      // Fallback an toan neu logout throw bat ngo.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('permissions');
      window.dispatchEvent(new CustomEvent(SESSION_LOGGED_OUT_EVENT));
      navigate('/login', { replace: true });
      if (window.location.pathname !== LOGIN_PATH) {
        window.location.replace(LOGIN_PATH);
      }
    }
  }

  if (!visible) return null;

  const replaced = detail?.code === 'SESSION_REPLACED';
  const title = replaced
    ? 'Đã có người đăng nhập tài khoản của bạn'
    : 'Phiên đăng nhập đã hết hạn';
  const message = replaced
    ? 'Đã có người đăng nhập tài khoản của bạn. Phiên hiện tại sẽ bị đăng xuất.'
    : 'Phiên đăng nhập của bạn đã hết hiệu lực. Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.';

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-icon modal-icon--warning">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn--primary" onClick={handleLogin}>
            Đăng nhập lại
          </button>
        </div>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .modal-box {
          background: #fff;
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 420px;
          width: 90%;
        }
        .modal-icon--warning {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #fef3c7;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: #d97706;
        }
        .modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 12px;
        }
        .modal-message {
          color: #64748b;
          margin: 0 0 24px;
          line-height: 1.6;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
