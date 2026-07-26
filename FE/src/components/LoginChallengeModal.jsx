import { useEffect, useState, useCallback } from 'react';
import { approvePendingLoginApi, rejectPendingLoginApi } from '../services/authApi';
import './LoginChallengeModal.css';

/**
 * Alert lớn bắt buộc: phiên đang online phải Đồng ý / Từ chối thiết bị mới.
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

  // Không cho đóng bằng Escape — phải chọn Đồng ý / Từ chối
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (!pendingId) return null;

  return (
    <div className="login-challenge-overlay" role="alertdialog" aria-modal="true" aria-labelledby="login-challenge-title">
      <div className="login-challenge-modal">
        <div className="login-challenge-modal__banner">Cảnh báo bảo mật</div>
        <div className="login-challenge-modal__icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 id="login-challenge-title" className="login-challenge-modal__title">
          Có người đang đăng nhập tài khoản của bạn!
        </h2>
        <p className="login-challenge-modal__message">
          Thiết bị <strong>{device}</strong>
          {ip ? <> (IP <strong>{ip}</strong>)</> : null} đang yêu cầu vào hệ thống.
          <br />
          Nếu đó là bạn hãy <strong>Đồng ý</strong>. Nếu không hãy <strong>Từ chối</strong> để chặn họ.
        </p>
        {error && <p className="login-challenge-modal__error">{error}</p>}
        <div className="login-challenge-modal__actions">
          <button
            type="button"
            className="login-challenge-btn login-challenge-btn--reject"
            disabled={busy}
            onClick={handleReject}
          >
            Từ chối — đá ra
          </button>
          <button
            type="button"
            className="login-challenge-btn login-challenge-btn--approve"
            disabled={busy}
            onClick={handleApprove}
          >
            {busy ? 'Đang xử lý...' : 'Đó là tôi — đồng ý'}
          </button>
        </div>
        <p className="login-challenge-modal__hint">Bạn phải chọn một trong hai để tiếp tục làm việc.</p>
      </div>
    </div>
  );
}
