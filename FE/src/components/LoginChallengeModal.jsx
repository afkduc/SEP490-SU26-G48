import { useEffect, useState, useCallback } from 'react';
import { approvePendingLoginApi, rejectPendingLoginApi } from '../services/authApi';
import './LoginChallengeModal.css';

/**
 * Modal cho phiên đang đăng nhập: có thiết bị khác xin vào.
 * Được kích hoạt bởi notification LOGIN_CHALLENGE (SSE).
 */
export default function LoginChallengeModal({ challenge, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pendingId = challenge?.pendingId || challenge?.metadata?.pendingId;
  const device =
    challenge?.device ||
    [challenge?.metadata?.browser, challenge?.metadata?.os].filter(Boolean).join(' · ') ||
    'Thiết bị khác';
  const ip = challenge?.ip || challenge?.metadata?.ip;

  const handleApprove = useCallback(async () => {
    if (!pendingId) return;
    setBusy(true);
    setError('');
    try {
      await approvePendingLoginApi(pendingId);
      onClose?.({ decided: 'approved' });
    } catch (err) {
      setError(err.message || 'Không thể đồng ý');
    } finally {
      setBusy(false);
    }
  }, [pendingId, onClose]);

  const handleReject = useCallback(async () => {
    if (!pendingId) return;
    setBusy(true);
    setError('');
    try {
      await rejectPendingLoginApi(pendingId);
      onClose?.({ decided: 'rejected' });
    } catch (err) {
      setError(err.message || 'Không thể từ chối');
    } finally {
      setBusy(false);
    }
  }, [pendingId, onClose]);

  useEffect(() => {
    if (!pendingId) onClose?.();
  }, [pendingId, onClose]);

  if (!pendingId) return null;

  return (
    <div className="login-challenge-overlay" role="dialog" aria-modal="true">
      <div className="login-challenge-modal">
        <div className="login-challenge-modal__icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="login-challenge-modal__title">Có người đang đăng nhập tài khoản của bạn</h2>
        <p className="login-challenge-modal__message">
          Thiết bị <strong>{device}</strong>
          {ip ? ` (IP ${ip})` : ''} đang yêu cầu vào hệ thống. Nếu đó là bạn, hãy đồng ý. Nếu không, hãy từ chối để đá họ ra.
        </p>
        {error && <p className="login-challenge-modal__error">{error}</p>}
        <div className="login-challenge-modal__actions">
          <button type="button" className="login-challenge-btn login-challenge-btn--reject" disabled={busy} onClick={handleReject}>
            Từ chối
          </button>
          <button type="button" className="login-challenge-btn login-challenge-btn--approve" disabled={busy} onClick={handleApprove}>
            {busy ? 'Đang xử lý...' : 'Đó là tôi — đồng ý'}
          </button>
        </div>
      </div>
    </div>
  );
}
