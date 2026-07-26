import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FORBIDDEN_KEY } from '../services/httpClient';
import { useAuth, getRoleHome } from '../contexts/AppContext';
import { requestPermission } from '../services/notificationApi';

let modalShownAt = 0;
const MIN_REDISPLAY_INTERVAL_MS = 2000;

/**
 * Modal 403 — UI chuyên nghiệp + form gửi yêu cầu cấp quyền (kèm lý do).
 */
export default function ForbiddenModal() {
  const [visible, setVisible] = useState(false);
  const [permissionKey, setPermissionKey] = useState(null);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const visibleRef = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClose = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
    setReason('');
    setSent(false);
    setSendError('');
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (window.location.pathname === '/login') return;
      const now = Date.now();
      if (now - modalShownAt < MIN_REDISPLAY_INTERVAL_MS) return;
      if (visibleRef.current) return;

      const detail = event?.detail || {};
      modalShownAt = now;
      visibleRef.current = true;
      setPermissionKey(detail.permissionKey || null);
      setMessage(detail.message || 'Bạn không có quyền thực hiện thao tác này');
      setReason('');
      setSent(false);
      setSendError('');
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

  async function handleRequestPermission() {
    if (sending || sent || !permissionKey) return;
    setSending(true);
    setSendError('');
    try {
      await requestPermission(permissionKey, reason.trim(), window.location.pathname);
      setSent(true);
    } catch (e) {
      setSendError(e?.message || 'Không gửi được yêu cầu. Thử lại sau.');
    } finally {
      setSending(false);
    }
  }

  if (!visible) return null;

  const friendlyMsg = permissionKey
    ? (message.includes(permissionKey)
      ? message
      : `Bạn không có quyền "${permissionKey}" để truy cập trang này.`)
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

        {permissionKey && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px', color: '#94a3b8', fontSize: 12,
            }}>
              <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              hoặc
              <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#475569', textAlign: 'center' }}>
              Cần quyền này? Gửi yêu cầu tới quản trị viên
            </p>

            {!sent ? (
              <>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Lý do cần quyền (không bắt buộc)..."
                  rows={3}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    fontSize: 13,
                    resize: 'vertical',
                    marginBottom: 10,
                    fontFamily: 'inherit',
                  }}
                />
                {sendError && (
                  <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 8px' }}>{sendError}</p>
                )}
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleRequestPermission}
                  disabled={sending}
                  style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {sending ? 'Đang gửi...' : 'Yêu cầu cấp quyền'}
                </button>
              </>
            ) : (
              <div style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: '#ecfdf5',
                color: '#047857',
                fontSize: 13,
                textAlign: 'center',
                fontWeight: 600,
              }}>
                Đã gửi yêu cầu. Admin sẽ xử lý sớm.
              </div>
            )}

            <p style={{
              margin: '12px 0 0',
              padding: '8px 10px',
              background: '#f8fafc',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'ui-monospace, Consolas, monospace',
              color: '#64748b',
              wordBreak: 'break-all',
            }}>
              Quyền yêu cầu: {permissionKey}
            </p>
          </>
        )}
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
        .btn--primary { background: #2563eb; color: #fff; }
        .btn--primary:disabled { opacity: 0.65; cursor: not-allowed; }
        .btn--secondary { background: #fff; color: #334155; border-color: #e2e8f0; }
      `}</style>
    </div>
  );
}
