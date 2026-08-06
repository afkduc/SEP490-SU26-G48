import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCrmSearchSync } from '../../utils/crmUrl';
import AdminLoginSessionsPage from './AdminLoginSessionsPage';
import AdminDevicesPage from './AdminDevicesPage';
import SecurityAlertsPanel from './SecurityAlertsPanel';
import SecurityAlertRelatedHistory from './SecurityAlertRelatedHistory';
import { buildSessionSeedFromAlert } from './securityAlertFocus';
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

function FocusContextBanner({ text, onClear, onHandleDevices }) {
  if (!text) return null;
  return (
    <div className="admin-hub__focus-banner" role="status">
      <div className="admin-hub__focus-banner-text">
        <strong>Đang xem theo cảnh báo:</strong> {text}
      </div>
      <div className="admin-hub__focus-banner-actions">
        {typeof onHandleDevices === 'function' && (
          <button type="button" className="btn btn--primary btn--sm" onClick={onHandleDevices}>
            Xử lý trên tab Thiết bị
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
          Xóa bộ lọc
        </button>
      </div>
    </div>
  );
}

function resolveTab(rawTab) {
  if (rawTab === 'sessions') return 'sessions';
  return 'devices';
}

/**
 * Luồng gọn:
 * 1. Tab Thiết bị — panel cảnh báo (banner) + danh sách thiết bị
 * 2. «Xem phiên» → thẳng tab Lịch sử (lọc sẵn), highlight phiên mới nhất
 * 3. «Xử lý trên tab Thiết bị» → thu gọn cảnh báo về banner
 * 4. Bảng «các lần cùng loại» chỉ hiện khi ≥ 2 lần
 */
export default function AdminLoginSecurityPage() {
  const [searchParams] = useSearchParams();
  const syncSearch = useCrmSearchSync();
  const activeTab = resolveTab(searchParams.get('tab'));
  const [urgentCount, setUrgentCount] = useState(0);
  const [alertsExpanded, setAlertsExpanded] = useState(
    () => searchParams.get('alerts') === '1' || searchParams.get('tab') === 'alerts'
  );
  const [sessionSeed, setSessionSeed] = useState({
    key: 0,
    userName: '',
    ipAddress: '',
    startDate: '',
    endDate: '',
    actionType: '',
    sessionId: null,
    focusSessionId: null,
    focusIp: '',
    focusLoginTime: '',
    context: '',
    alert: null,
  });

  const [deviceSeed, setDeviceSeed] = useState({
    key: 0,
    userId: null,
    search: '',
    focusIp: '',
    focusLoginTime: '',
    // '' = mọi thiết bị của user; 'true' = chỉ đang Hiện tại
    isCurrent: '',
  });

  useEffect(() => {
    if (searchParams.get('tab') !== 'alerts') return;
    syncSearch((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tab');
      next.set('alerts', '1');
      return next;
    }, { replace: true });
    setAlertsExpanded(true);
  }, [searchParams, syncSearch]);

  // Deep-link từ chuông thông báo: ?userId=&search=&ip=&tab=devices|sessions
  useEffect(() => {
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');
    const ip = searchParams.get('ip');
    if (!userId && !search && !ip) return;

    const tab = resolveTab(searchParams.get('tab'));
    if (tab === 'sessions') {
      setSessionSeed((prev) => ({
        ...prev,
        key: prev.key + 1,
        userName: search || '',
        ipAddress: ip || '',
        focusIp: ip || '',
        actionType: 'LOGIN',
        preferLatest: true,
        context: [search, ip].filter(Boolean).join(' · '),
      }));
    } else {
      setDeviceSeed((prev) => ({
        ...prev,
        key: prev.key + 1,
        userId: userId ? Number(userId) || userId : null,
        search: search || '',
        focusIp: ip || '',
        isCurrent: '',
      }));
    }

    syncSearch((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('userId');
      next.delete('search');
      next.delete('ip');
      return next;
    }, { replace: true });
  // Chi chay khi mount / khi query deep-link doi
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('userId'), searchParams.get('search'), searchParams.get('ip'), searchParams.get('tab')]);

  const setActiveTab = useCallback((tab) => {
    syncSearch((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'devices') next.delete('tab');
      else next.set('tab', tab);
      if (tab === 'sessions') next.delete('alerts');
      return next;
    });
  }, [syncSearch]);

  const handleAlertsExpanded = useCallback((open) => {
    setAlertsExpanded(open);
    syncSearch((prev) => {
      const next = new URLSearchParams(prev);
      if (open) next.set('alerts', '1');
      else next.delete('alerts');
      return next;
    });
  }, [syncSearch]);

  const handleCounts = useCallback((countsOrTotal) => {
    if (countsOrTotal && typeof countsOrTotal === 'object') {
      const urgent = (Number(countsOrTotal.critical) || 0) + (Number(countsOrTotal.high) || 0);
      setUrgentCount(urgent);
      return;
    }
    setUrgentCount(Number(countsOrTotal) || 0);
  }, []);

  /** Thẳng sang tab Lịch sử — lọc phiên theo cảnh báo. */
  const handleOpenSessions = useCallback((alert) => {
    const seed = buildSessionSeedFromAlert(alert);
    if (!seed) {
      setSessionSeed((prev) => ({
        ...prev,
        key: prev.key + 1,
        alert: alert || null,
        context: alert?.title || '',
      }));
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
      sessionId: seed.sessionId || null,
      focusSessionId: seed.focusSessionId || seed.sessionId || null,
      focusIp: seed.focusIp || '',
      focusLoginTime: seed.focusLoginTime || '',
      context: seed.context || '',
      alert: alert || null,
    }));
    setActiveTab('sessions');
  }, [setActiveTab]);

  const clearSessionFocus = useCallback(() => {
    setSessionSeed((prev) => ({
      key: prev.key + 1,
      userName: '',
      ipAddress: '',
      startDate: '',
      endDate: '',
      actionType: '',
      sessionId: null,
      focusSessionId: null,
      focusIp: '',
      focusLoginTime: '',
      context: '',
      alert: null,
    }));
  }, []);

  /** Từ cảnh báo / phiên → tab Thiết bị để force logout. */
  const handleOpenDevicesToProcess = useCallback((opts = {}) => {
    const alert = opts.alert || sessionSeed.alert;
    const userId = opts.userId || alert?.userId || null;
    const userName = opts.userName || alert?.userName || alert?.displayName || '';
    const rule = alert?.ruleKey || '';
    // session_takeover: ưu tiên máy đang Hiện tại để đăng xuất.
    // new_device_ip / còn lại: xem mọi thiết bị của user (máy mới có thể đã không còn is_current).
    const isCurrent = opts.isCurrent != null
      ? opts.isCurrent
      : (rule === 'session_takeover' ? 'true' : '');
    setDeviceSeed((prev) => ({
      key: prev.key + 1,
      userId: userId ? Number(userId) : null,
      search: userId ? '' : (userName || ''),
      focusIp: opts.ipAddress || sessionSeed.focusIp || sessionSeed.ipAddress || '',
      focusLoginTime: opts.loginTime || sessionSeed.focusLoginTime || '',
      isCurrent,
    }));
    // Thu gọn cảnh báo về banner — ưu tiên bảng thiết bị khi đang xử lý
    handleAlertsExpanded(false);
    setActiveTab('devices');
  }, [sessionSeed, setActiveTab, handleAlertsExpanded]);

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
              Xem cảnh báo → Đã xem hoặc Xem phiên. Xử lý đăng xuất trên danh sách thiết bị / chi tiết phiên.
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
            {tab.id === 'devices' && urgentCount > 0 && (
              <span className="admin-hub__tab-count">{urgentCount > 99 ? '99+' : urgentCount}</span>
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
              onOpenSessions={handleOpenSessions}
              onCountChange={handleCounts}
            />
            <div id="admin-devices-anchor">
              <AdminDevicesPage
                embedded
                seedKey={deviceSeed.key}
                seedUserId={deviceSeed.userId}
                seedSearch={deviceSeed.search}
                seedFocusIp={deviceSeed.focusIp}
                seedFocusLoginTime={deviceSeed.focusLoginTime}
                seedIsCurrent={deviceSeed.isCurrent}
              />
            </div>
          </div>
        )}
        {activeTab === 'sessions' && (
          <div className="admin-hub__stack">
            <FocusContextBanner
              text={sessionSeed.context}
              onClear={clearSessionFocus}
              onHandleDevices={
                (sessionSeed.alert?.userId || sessionSeed.userName)
                  ? () => handleOpenDevicesToProcess()
                  : undefined
              }
            />
            <AdminLoginSessionsPage
              embedded
              seedUserName={sessionSeed.userName}
              seedIpAddress={sessionSeed.ipAddress}
              seedStartDate={sessionSeed.startDate}
              seedEndDate={sessionSeed.endDate}
              seedActionType={sessionSeed.actionType}
              seedSessionId={sessionSeed.sessionId}
              seedFocusSessionId={sessionSeed.focusSessionId}
              seedFocusIp={sessionSeed.focusIp}
              seedFocusLoginTime={sessionSeed.focusLoginTime}
              seedKey={sessionSeed.key}
            />
            <SecurityAlertRelatedHistory
              alert={sessionSeed.alert}
              minCount={2}
              onClear={() => setSessionSeed((prev) => ({ ...prev, alert: null }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
