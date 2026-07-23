import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FORBIDDEN_KEY } from '../services/httpClient';
import { useAuth, getRoleHome } from '../contexts/AppContext';
import { requestPermission } from '../services/notificationApi';

/**
 * Modal toan man hinh hien thi khi API tra 403 Forbidden.
 *
 * Pattern giong SessionExpiredModal:
 * - Lang nghe window event FORBIDDEN_KEY tu httpClient
 * - Anti-spam: ref flag (khong show nhieu lan khi nhieu API cung bi 403)
 * - User click "Quay lai" -> navigate(-1) neu co history, nguoc lai ve home
 * - User co the gui yeu cau cap quyen -> BE notify admin
 *
 * Flow:
 *   1. User goi API ma BE check permission -> BE tra 403
 *   2. httpClient nhan 403 -> dispatch FORBIDDEN_KEY event
 *   3. ForbiddenModal listener (anti-spam) -> show modal
 *   4. User chon "Quay lai" hoac "Yeu cau cap quyen"
 */
export default function ForbiddenModal() {
  const [visible, setVisible] = useState(false);
  const [permissionKey, setPermissionKey] = useState(null);
  const [message, setMessage] = useState('');
  const visibleRef = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClose = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      // Bo qua neu user dang o trang login (tranh modal nhay khi login fail)
      if (window.location.pathname === '/login') return;
      // Tranh spam: nhieu request 403 cung luc -> chi show 1 lan
      if (visibleRef.current) return;

      const detail = event?.detail || {};
      visibleRef.current = true;
      setPermissionKey(detail.permissionKey || null);
      setMessage(detail.message || 'Bạn không có quyền thực hiện thao tác này');
      setVisible(true);
    };

    window.addEventListener(FORBIDDEN_KEY, handler);
    return () => window.removeEventListener(FORBIDDEN_KEY, handler);
  }, []);

  function handleBack() {
    handleClose();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(getRoleHome(user) || '/dashboard', { replace: true });
    }
  }

  function handleHome() {
    handleClose();
    navigate(getRoleHome(user) || '/dashboard', { replace: true });
  }

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  async function handleRequestPermission() {
    if (sending || sent || !permissionKey) return;
    setSending(true);
    try {
      await requestPermission(
        permissionKey,
        '',
        window.location.pathname
      );
      setSent(true);
    } catch (e) {
      // Van hien nhu da gui de user khong retry lien tuc
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-icon modal-icon--danger">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <circle cx="12" cy="17" r="1" fill="currentColor"/>
          </svg>
        </div>
        <h2 className="modal-title">403 - Không có quyền truy cập</h2>
        <p className="modal-message">{message}</p>
        {permissionKey ? (
          <div style={{
            margin: '12px 0',
            padding: '10px 14px',
            background: '#f5f5f5',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#444',
            border: '1px solid #e0e0e0',
            textAlign: 'left',
          }}>
            <strong>Permission:</strong> {permissionKey}
          </div>
        ) : null}

        <div className="modal-actions" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn--secondary" onClick={handleBack}>
            ← Quay lại
          </button>
          <button className="btn btn--secondary" onClick={handleHome}>
            Về trang chủ
          </button>
          {permissionKey ? (
            <button
              className="btn btn--primary"
              onClick={handleRequestPermission}
              disabled={sending || sent}
              style={{
                opacity: sent ? 0.7 : 1,
                cursor: sent ? 'default' : 'pointer',
              }}
            >
              {sent ? '✓ Đã gửi yêu cầu' : sending ? 'Đang gửi...' : 'Yêu cầu cấp quyền'}
            </button>
          ) : null}
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
          z-index: 9998;
        }
        .modal-box {
          background: #fff;
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 460px;
          width: 90%;
        }
        .modal-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          margin: 0 auto 16px;
        }
        .modal-icon--danger {
          background: #fee2e2;
          color: #dc2626;
        }
        .modal-title {
          margin: 0 0 12px;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
        }
        .modal-message {
          margin: 0 0 8px;
          font-size: 14px;
          color: #4b5563;
          line-height: 1.5;
        }
        .modal-actions {
          display: flex;
          gap: 8px;
          margin-top: 20px;
        }
        .btn {
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: opacity 0.15s, background 0.15s;
        }
        .btn--primary {
          background: #2563eb;
          color: white;
        }
        .btn--primary:hover {
          background: #1d4ed8;
        }
        .btn--secondary {
          background: #f3f4f6;
          color: #1f2937;
        }
        .btn--secondary:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
