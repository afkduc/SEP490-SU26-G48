import { useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import AdminProfilePage from './AdminProfilePage';
import AdminProfileNotificationsPage from './AdminProfileNotificationsPage';
import './AdminHub.css';

const TABS = [
  { id: 'profile', label: 'Hồ sơ' },
  { id: 'notifications', label: 'Thông báo' },
];

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function resolveTab(raw) {
  if (raw === 'notifications') return 'notifications';
  // tab=devices cũ → về hồ sơ
  return 'profile';
}

export default function AdminAccountPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditMode = location.pathname.endsWith('/edit');
  const activeTab = isEditMode ? 'profile' : resolveTab(searchParams.get('tab'));

  const setActiveTab = useCallback((tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'profile') next.delete('tab');
      else next.set('tab', tab);
      return next;
    });
  }, [setSearchParams]);

  return (
    <div className="admin-page admin-hub">
      <div className="admin-hub__header">
        <div className="admin-hub__title-block">
          <div className="admin-hub__title-icon admin-hub__title-icon--account">
            <IconUser />
          </div>
          <div className="admin-hub__title-group">
            <h1>Tài khoản của tôi</h1>
            <p className="admin-hub__subtitle">Hồ sơ và cài đặt thông báo</p>
          </div>
        </div>
      </div>

      {!isEditMode && (
        <nav className="admin-hub__tabs" aria-label="Tài khoản của tôi">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-hub__tab${activeTab === tab.id ? ' admin-hub__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      <div className="admin-hub__body">
        {activeTab === 'notifications' ? (
          <AdminProfileNotificationsPage embedded />
        ) : (
          <AdminProfilePage embedded />
        )}
      </div>
    </div>
  );
}
