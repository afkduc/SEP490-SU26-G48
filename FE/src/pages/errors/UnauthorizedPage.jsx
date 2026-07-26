import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { getRoleHome } from '../../contexts/AppContext';
import { requestPermission } from '../../services/notificationApi';
import './UnauthorizedPage.css';

export default function UnauthorizedPage({ permissionKey, customMessage }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [reason, setReason] = useState('');
  const [sendError, setSendError] = useState('');

  const handleGoHome = () => {
    navigate(getRoleHome(user), { replace: true });
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(getRoleHome(user), { replace: true });
    }
  };

  const handleRequestPermission = async () => {
    if (!permissionKey || sent || sending) return;
    setSending(true);
    setSendError('');
    try {
      await requestPermission(
        permissionKey,
        reason,
        window.location.pathname
      );
      setSent(true);
    } catch (e) {
      setSendError(e?.message || 'Không gửi được yêu cầu. Thử lại sau.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="error-page">
      <div className="error-page__bg">
        <div className="error-page__shape error-page__shape--1" />
        <div className="error-page__shape error-page__shape--2" />
        <div className="error-page__shape error-page__shape--3" />
      </div>

      <div className="error-card">
        {/* Icon */}
        <div className="error-card__icon-wrapper">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <line x1="12" y1="15" x2="12" y2="15.01" strokeWidth="2"/>
          </svg>
        </div>

        {/* Status */}
        <div className="error-card__status">403</div>

        {/* Title */}
        <h1 className="error-card__title">Không có quyền truy cập</h1>

        {/* Description */}
        <p className="error-card__desc">
          {customMessage || (
            permissionKey
              ? `Bạn không có quyền "${permissionKey}" để thực hiện thao tác này.`
              : 'Bạn không có quyền truy cập vào trang hoặc thao tác này.'
          )}
        </p>

        {/* Quick Actions */}
        <div className="error-card__actions">
          <button
            className="error-card__btn error-card__btn--primary"
            onClick={handleGoBack}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Quay lại
          </button>

          <button
            className="error-card__btn error-card__btn--secondary"
            onClick={handleGoHome}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Về trang chủ
          </button>
        </div>

        {/* Request Permission Section */}
        {permissionKey && (
          <div className="error-card__request-section">
            <div className="error-card__divider">
              <span>hoặc</span>
            </div>

            {sent ? (
              <div className="error-card__success">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Đã gửi yêu cầu cấp quyền tới quản trị viên
              </div>
            ) : (
              <>
                <p className="error-card__request-label">
                  Cần quyền này? Gửi yêu cầu tới quản trị viên
                </p>

                <textarea
                  className="error-card__textarea"
                  placeholder="Lý do cần quyền (không bắt buộc)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />

                {sendError && (
                  <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 8px' }}>{sendError}</p>
                )}

                <button
                  className="error-card__btn error-card__btn--request"
                  onClick={handleRequestPermission}
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <svg className="error-card__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Yêu cầu cấp quyền
                    </>
                  )}
                </button>

                <p className="error-card__request-hint">
                  Quyền yêu cầu: <code>{permissionKey}</code>
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Legacy export for backward compatibility
export function UnauthorizedPageLegacy() {
  return <UnauthorizedPage />;
}
