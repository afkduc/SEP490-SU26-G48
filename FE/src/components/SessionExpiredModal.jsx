import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SESSION_EXPIRED_KEY } from '../services/httpClient';

// Module-level flag da chong spam DUNG ROI giua cac instance StrictMode/HMR.
// Su dung module-level (khong phai useRef) de:
//   1. StrictMode dev: useEffect chay 2 lan nhung cung 1 module flag -> 1 modal.
//   2. HMR: neu component remount, flag van giu nguyen -> tranh re-show.
//   3. Neu 2 instance khac nhau cung import file nay, van chi 1 modal.
let modalShownAt = 0;
const MIN_REDISPLAY_INTERVAL_MS = 60_000; // 60s: phai doi 60s truoc khi hien lai

export default function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event) => {
      // Bo qua neu user dang o trang login (tranh modal nhap nhay).
      if (window.location.pathname === '/login') return;
      // Anti-spam: kiem tra module-level flag. Khoa 60s giua cac lan hien.
      const now = Date.now();
      if (now - modalShownAt < MIN_REDISPLAY_INTERVAL_MS) {
        return;
      }
      modalShownAt = now;
      setVisible(true);
    };
    window.addEventListener(SESSION_EXPIRED_KEY, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_KEY, handler);
  }, []);

  // Reset flag khi user dang nhap lai (token moi -> session moi).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'token' && e.newValue) {
        // Login moi -> reset de lan sau gap 401 se hien modal.
        modalShownAt = 0;
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function handleLogin() {
    modalShownAt = 0;
    setVisible(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('permissions');
    navigate('/login', { replace: true });
  }

  if (!visible) return null;

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
        <h2 className="modal-title">Phiên đăng nhập đã hết hạn</h2>
        <p className="modal-message">
          Phiên đăng nhập của bạn đã hết hiệu lực. Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.
        </p>
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
