import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SESSION_EXPIRED_KEY } from '../services/httpClient';

export default function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const visibleRef = useRef(false);

  useEffect(() => {
    const handler = (event) => {
      // Bo qua neu user dang o trang login (tranh modal nhap nhay).
      if (window.location.pathname === '/login') return;
      // Tranh spam: neu modal dang hien thi -> khong dispatch nua.
      if (visibleRef.current) return;
      // Cho phep caller bo qua bang cach truyen detail.skipIfVisible
      const detail = event?.detail || {};
      if (detail.skipIfVisible && visibleRef.current) return;

      visibleRef.current = true;
      setVisible(true);
    };
    window.addEventListener(SESSION_EXPIRED_KEY, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_KEY, handler);
  }, []);

  // Reset flag khi modal dong va user bam "Dang nhap lai"
  function handleLogin() {
    visibleRef.current = false;
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
