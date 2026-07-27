import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLoginSessionsPage from './AdminLoginSessionsPage';
import AdminDevicesPage from './AdminDevicesPage';
import SecurityAlertsPanel from './SecurityAlertsPanel';
import {
  buildDeviceSeedFromAlert,
  buildSessionSeedFromAlert,
} from './securityAlertFocus';
import './AdminHub.css';

const TABS = [
  { id: 'devices', label: 'Thiết bị' },
  { id: 'sessions', label: 'Lịch sử' },
];

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function FocusContextBanner({ text, onClear }) {
  if (!text) return null;
  return (
    <div className="admin-hub__focus-banner" role="status">
      <div className="admin-hub__focus-banner-text">
        <strong>Đang xem theo cảnh báo:</strong> {text}
      </div>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
        Xóa bộ lọc
      </button>
    </div>
  );
}

function resolveTab(rawTab) {
  if (rawTab === 'sessions') return 'sessions';
  return 'devices';
}

export default function AdminLoginSecurityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));
  const [alertCount, setAlertCount] = useState(0);
  const [alertsExpanded, setAlertsExpanded] = useState(
    () => searchParams.get('alerts') === '1' || searchParams.get('tab') === 'alerts'
  );
  const [deviceSeed, setDeviceSeed] = useState({
    key: 0,
    search: '',
    userId: null,
    isCurrent: '',
    context: '',
  });
  const [sessionSeed, setSessionSeed] = useState({
    key: 0,
    userName: '',
    ipAddress: '',
    startDate: '',
    endDate: '',
    actionType: '',
    context: '',
  });

  useEffect(() => {
    if (searchParams.get('tab') !== 'alerts') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tab');
      next.set('alerts', '1');
      return next;
    }, { replace: true });
    setAlertsExpanded(true);
  }, [searchParams, setSearchParams]);

  const setActiveTab = useCallback((tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'devices') next.delete('tab');
      else next.set('tab', tab);
      if (tab === 'sessions') next.delete('alerts');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleAlertsExpanded = useCallback((open) => {
    setAlertsExpanded(open);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (open) next.set('alerts', '1');
      else next.delete('alerts');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleFocusDevice = useCallback((alertOrPayload) => {
    const seed = alertOrPayload?.ruleKey != null || alertOrPayload?.id != null
      ? buildDeviceSeedFromAlert(alertOrPayload)
      : alertOrPayload;
    if (!seed) return;
    setActiveTab('devices');
    setDeviceSeed((prev) => ({
      key: prev.key + 1,
      search: seed.search || '',
      userId: seed.userId || null,
      isCurrent: seed.isCurrent ?? '',
      context: seed.context || '',
    }));
    // Đợi tab/panel render rồi cuộn tới bảng thiết bị
    setTimeout(() => {
      document.getElementById('admin-devices-anchor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }, [setActiveTab]);

  const handleOpenSessions = useCallback((alert) => {
    const seed = buildSessionSeedFromAlert(alert);
    if (!seed) {
      setActiveTab('sessions');
      return;
    }
    setSessionSeed((prev) => ({
      key: prev.key + 1,
      userName: seed.userName || '',
      ipAddress: seed.ipAddress || '',
      startDate: seed.startDate || '',
      endDate: seed.endDate || '',
      actionType: seed.actionType || '',
      context: seed.context || '',
    }));
    setActiveTab('sessions');
  }, [setActiveTab]);

  const clearDeviceFocus = useCallback(() => {
    setDeviceSeed((prev) => ({
      key: prev.key + 1,
      search: '',
      userId: null,
      isCurrent: '',
      context: '',
    }));
  }, []);

  const clearSessionFocus = useCallback(() => {
    setSessionSeed((prev) => ({
      key: prev.key + 1,
      userName: '',
      ipAddress: '',
      startDate: '',
      endDate: '',
      actionType: '',
      context: '',
    }));
  }, []);

  return (
    <div className="admin-page admin-hub">
      <div className="admin-hub__header">
        <div className="admin-hub__title-block">
          <div className="admin-hub__title-icon admin-hub__title-icon--security">
            <IconShield />
          </div>
          <div className="admin-hub__title-group">
            <h1>Bảo mật đăng nhập</h1>
            <p className="admin-hub__subtitle">
              Từ cảnh báo có thể mở đúng thiết bị và toàn bộ lịch sử của tài khoản liên quan
            </p>
          </div>
        </div>
      </div>

      <nav className="admin-hub__tabs" aria-label="Bảo mật đăng nhập">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-hub__tab${activeTab === tab.id ? ' admin-hub__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'devices' && alertCount > 0 && (
              <span className="admin-hub__tab-count">{alertCount > 100 ? '99+' : alertCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="admin-hub__body">
        {activeTab === 'devices' && (
          <div className="admin-hub__stack">
            <SecurityAlertsPanel
              expanded={alertsExpanded}
              onExpandedChange={handleAlertsExpanded}
              onFocusDevice={handleFocusDevice}
              onOpenSessions={handleOpenSessions}
              onCountChange={setAlertCount}
            />
            <FocusContextBanner text={deviceSeed.context} onClear={clearDeviceFocus} />
            <div id="admin-devices-anchor">
              <AdminDevicesPage
                embedded
                seedSearch={deviceSeed.search}
                seedUserId={deviceSeed.userId}
                seedIsCurrent={deviceSeed.isCurrent}
                seedKey={deviceSeed.key}
              />
            </div>
          </div>
        )}
        {activeTab === 'sessions' && (
          <div className="admin-hub__stack">
            <FocusContextBanner text={sessionSeed.context} onClear={clearSessionFocus} />
            <AdminLoginSessionsPage
              embedded
              seedUserName={sessionSeed.userName}
              seedIpAddress={sessionSeed.ipAddress}
              seedStartDate={sessionSeed.startDate}
              seedEndDate={sessionSeed.endDate}
              seedActionType={sessionSeed.actionType}
              seedKey={sessionSeed.key}
            />
          </div>
        )}
      </div>
    </div>
  );
}
