import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { getRoleHome } from '../../contexts/AppContext';
import { getPermissionScreenLabel } from '../../utils/screenLabels';
import './UnauthorizedPage.css';

export default function UnauthorizedPage({ permissionKey, customMessage }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const friendlyKey = permissionKey
    ? (getPermissionScreenLabel(permissionKey) !== '—'
      ? getPermissionScreenLabel(permissionKey)
      : 'truy cập trang này')
    : null;

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

  return (
    <div className="error-page">
      <div className="error-page__bg">
        <div className="error-page__shape error-page__shape--1" />
        <div className="error-page__shape error-page__shape--2" />
        <div className="error-page__shape error-page__shape--3" />
      </div>

      <div className="error-card">
        <div className="error-card__icon-wrapper">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <line x1="12" y1="15" x2="12" y2="15.01" strokeWidth="2"/>
          </svg>
        </div>

        <div className="error-card__status">403</div>

        <h1 className="error-card__title">Không có quyền truy cập</h1>

        <p className="error-card__desc">
          {customMessage || (
            friendlyKey
              ? `Bạn không có quyền truy cập «${friendlyKey}».`
              : 'Bạn không có quyền truy cập vào trang hoặc thao tác này.'
          )}
        </p>

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
      </div>
    </div>
  );
}

export function UnauthorizedPageLegacy() {
  return <UnauthorizedPage />;
}
