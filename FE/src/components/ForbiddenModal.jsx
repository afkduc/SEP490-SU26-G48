import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FORBIDDEN_KEY } from '../services/httpClient';
import { useAuth, getRoleHome } from '../contexts/AppContext';
import { getPermissionScreenLabel } from '../utils/screenLabels';
import { BASE_PATH } from '../config';

const LOGIN_PATH = `${BASE_PATH}/login`;
let modalShownAt = 0;
const MIN_REDISPLAY_INTERVAL_MS = 2000;

/**
 * Modal 403 — thông báo không có quyền truy cập.
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
      if (window.location.pathname === LOGIN_PATH) return;
      const now = Date.now();
      if (now - modalShownAt < MIN_REDISPLAY_INTERVAL_MS) return;
      if (visibleRef.current) return;

      const detail = event?.detail || {};
      modalShownAt = now;
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
    if (window.history.length > 1) navigate(-1);
    else navigate(getRoleHome(user) || '/dashboard', { replace: true });
  }

  function handleHome() {
    handleClose();
    navigate(getRoleHome(user) || '/dashboard', { replace: true });
  }

  if (!visible) return null;

  const friendlyLabel = permissionKey
    ? (getPermissionScreenLabel(permissionKey) !== '—'
      ? getPermissionScreenLabel(permissionKey)
      : null)
    : null;

  const friendlyMsg = friendlyLabel
    ? `Bạn không có quyền truy cập «${friendlyLabel}».`
    : message;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: 480, textAlign: 'left' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="modal-icon modal-icon--danger">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 999,
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 8,
          }}>403</span>
          <h2 className="modal-title">Không có quyền truy cập</h2>
          <p className="modal-message">{friendlyMsg}</p>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'center', marginBottom: 8 }}>
          <button className="btn btn--secondary" type="button" onClick={handleBack}>← Quay lại</button>
          <button className="btn btn--secondary" type="button" onClick={handleHome}>Về trang chủ</button>
        </div>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.45);
          display: flex; align-items: center; justify-content: center; z-index: 9998;
        }
        .modal-box {
          background: #fff; border-radius: 16px; padding: 28px 28px 24px;
          box-shadow: 0 24px 60px rgba(15,23,42,0.22); width: 90%;
        }
        .modal-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 12px;
        }
        .modal-icon--danger { background: #fee2e2; color: #dc2626; }
        .modal-title { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center; }
        .modal-message { margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.5; text-align: center; }
        .modal-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn {
          padding: 10px 16px; border-radius: 10px; font-size: 14px; font-weight: 600;
          border: 1px solid transparent; cursor: pointer;
        }
        .btn--secondary { background: #fff; color: #334155; border-color: #e2e8f0; }
      `}</style>
    </div>
  );
}
