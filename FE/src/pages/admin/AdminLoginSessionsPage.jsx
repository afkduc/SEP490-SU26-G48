import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLoginSessions } from '../../hooks/admin/useLoginSessions';
import { useLoginSessionsSSE } from '../../hooks/admin/useLoginSessionsSSE';
import { useSharedBranches } from '../../contexts/SharedDataContext';
import { useAuth } from '../../contexts/AppContext';
import { auditApi } from '../../services/auditApi';
import { downloadBlob } from '../../utils/downloadBlob';
import { pickLatestSession } from './securityAlertFocus';
import { normalizeVietnamese } from '../../utils/vietnamese';
import {
  formatPhoneInput,
  phoneDigitsForSearch,
  PHONE_INPUT_MAX_LENGTH,
} from '../../utils/validation';
import DateRangeInputs from '../../components/common/DateRangeInputs';
import { ACTION_OPTIONS, STATUS_OPTIONS } from './components/loginSessionFormatters';
import { IconSession, IconFilter, IconRefresh, IconTable } from './components/LoginSessionIcons';
import {
  StatsCards,
  Pagination,
  TableSkeleton,
  SessionTable,
} from './components/LoginSessionWidgets';
import './LoginSessionsPage.css';

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminLoginSessionsPage({
  embedded = false,
  seedUserName = '',
  seedIpAddress = '',
  seedStartDate = '',
  seedEndDate = '',
  seedActionType = '',
  seedSessionId = null,
  seedFocusSessionId = null,
  seedFocusIp = '',
  seedFocusLoginTime = '',
  seedKey = 0,
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const sessions = useLoginSessions(
    seedKey
      ? {
          userName: seedUserName || '',
          ipAddress: seedIpAddress || '',
          startDate: seedStartDate || '',
          endDate: seedEndDate || '',
          actionType: seedActionType || '',
          sessionId: seedSessionId || undefined,
          pageSize: seedSessionId ? 20 : 10,
        }
      : {}
  );
  const { branches, branchesError } = useSharedBranches();
  const { token } = useAuth();
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [focusedSessionId, setFocusedSessionId] = useState(null);
  const focusScrollPendingRef = useRef(false);
  const focusPayloadRef = useRef({
    sessionId: null,
    ip: '',
    loginTime: '',
  });

  const openSessionDetail = useCallback(
    (item) => {
      if (!item?.id) return;
      navigate(`/admin/login-sessions/${item.id}`, {
        state: {
          session: item,
          fromListSearch: location.search || '?tab=sessions',
        },
      });
    },
    [navigate, location.search]
  );

  // Seed từ panel cảnh báo ("Lịch sử") — khi đổi cảnh báo trong lúc tab đang mở
  useEffect(() => {
    if (!seedKey) return;
    focusPayloadRef.current = {
      // Không ghim sessionId cũ — luôn chọn phiên mới nhất trong list đã lọc
      sessionId: null,
      ip: seedFocusIp || seedIpAddress || '',
      loginTime: '',
    };
    focusScrollPendingRef.current = true;
    setFocusedSessionId(null);
    sessions.setParams(() => ({
      userName: seedUserName || '',
      phone: '',
      actionType: seedActionType || '',
      status: '',
      startDate: seedStartDate || '',
      endDate: seedEndDate || '',
      branchId: undefined,
      ipAddress: seedIpAddress || '',
      sessionId: undefined,
      page: 1,
      pageSize: 20,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  // Sau khi seed + list load xong: highlight + scroll tới phiên MỚI NHẤT
  useEffect(() => {
    if (!focusScrollPendingRef.current) return;
    if (sessions.loading) return;

    const payload = focusPayloadRef.current;
    const seeded = Boolean(
      seedKey &&
      (seedUserName || seedIpAddress || seedFocusIp || seedFocusSessionId || seedSessionId)
    );
    const hasFocus = seeded || String(payload.ip || '').trim();
    if (!hasFocus) {
      setFocusedSessionId(null);
      focusScrollPendingRef.current = false;
      return;
    }

    const match = pickLatestSession(sessions.data?.items || [], { ip: '' });
    if (!match) {
      setFocusedSessionId(null);
      focusScrollPendingRef.current = false;
      return;
    }

    setFocusedSessionId(match.id);
    requestAnimationFrame(() => {
      document.getElementById(`admin-session-row-${match.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
    focusScrollPendingRef.current = false;
  }, [
    sessions.data?.items,
    sessions.loading,
    seedKey,
    seedUserName,
    seedIpAddress,
    seedFocusIp,
    seedFocusSessionId,
    seedSessionId,
  ]);

  // Debounce refetch SSE - gom nhieu event thanh 1 lan refetch
  // (tranh nhap nhay khi user click nhieu action cung luc)
  const sseRefetchTimerRef = useRef(null);

  // Lay current items qua ref (tranh closure stale)
  const dataRef = useRef(sessions.data);
  const paramsRef = useRef(sessions.params);
  useEffect(() => {
    dataRef.current = sessions.data;
  }, [sessions.data]);
  useEffect(() => {
    paramsRef.current = sessions.params;
  }, [sessions.params]);

  // SSE: smart patch thay vi full refetch moi event.
  // - Neu co sessionId va ta biet id do, patch row tuong ung (khong refetch).
  // - Chi refetch full khi:
  //   (a) event khong co sessionId (khoang hiem)
  //   (b) row dang xem khong co trong page hien tai (do filter)
  // - Debounce 400ms de gom nhieu event.
  const handleSessionEvent = (eventData) => {
    const eventType = eventData && eventData.type;
    const sessionUserName = eventData && eventData.userName;
    const sessionUserId = eventData && eventData.userId;
    const sessionId = eventData && eventData.sessionId;
    const deviceId = eventData && eventData.deviceId;

    // Filter matching (AND — khong patch khi event khong thuoc filter hien tai)
    const p = paramsRef.current;
    const filterUserName = normalizeVietnamese(p.userName || '').trim();
    const filterPhoneDigits = String(p.phone || '').replace(/\D/g, '');
    const filterActionType = p.actionType || '';
    const filterStatus = p.status || '';
    const filterBranchId = p.branchId;

    if (filterUserName) {
      const haystack = normalizeVietnamese(
        [sessionUserName, eventData?.email, eventData?.userName].filter(Boolean).join(' ')
      );
      if (!haystack.includes(filterUserName)) {
        return; // Khong match filter userName -> bo qua
      }
    }
    if (filterPhoneDigits) {
      const eventPhoneDigits = String(eventData?.phone || eventData?.phoneNumber || '').replace(
        /\D/g,
        ''
      );
      if (!eventPhoneDigits.includes(filterPhoneDigits)) {
        return;
      }
    }
    if (filterActionType && eventType) {
      const actionMap = {
        login: 'LOGIN',
        logout: 'LOGOUT',
        force: 'FORCE_LOGOUT',
        login_failed: 'LOGIN_FAILED',
      };
      const expectedAction = actionMap[eventType] || eventType.toUpperCase();
      if (filterActionType !== expectedAction && filterActionType !== eventType) {
        return; // Khong match action filter
      }
    }
    if (filterStatus) {
      const statusByEvent = {
        login: 'active',
        logout: 'ended',
        force: 'ended',
        login_failed: 'failed',
      };
      const eventStatus = statusByEvent[eventType];
      if (eventStatus && filterStatus !== eventStatus) return;
    }
    // void for future use
    void sessionUserId;
    void filterBranchId;
    void deviceId;

    // Patch row inline (khong refetch full)
    if (sessionId && eventType) {
      const currentItems = dataRef.current?.items || [];
      const existingRow = currentItems.find((i) => i.id === sessionId);
      const newRow = buildRowFromEvent(eventType, eventData, existingRow);
      if (existingRow) {
        // Row ton tai trong page -> patch ngay
        sessions.setItems((prev) => prev.map((i) => (i.id === sessionId ? newRow : i)));
        return;
      }
      // Row moi chua co trong page -> can refetch de lay item moi (insert)
      // Debounce de gom nhieu event cung sessionId
      if (sseRefetchTimerRef.current) {
        clearTimeout(sseRefetchTimerRef.current);
      }
      sseRefetchTimerRef.current = setTimeout(() => {
        sessions.refetch();
        sseRefetchTimerRef.current = null;
      }, 400);
      return;
    }

    // Fallback: khong co sessionId -> refetch (de an toan)
    if (sseRefetchTimerRef.current) {
      clearTimeout(sseRefetchTimerRef.current);
    }
    sseRefetchTimerRef.current = setTimeout(() => {
      sessions.refetch();
      sseRefetchTimerRef.current = null;
    }, 400);
  };

  // Build row moi tu SSE event (de patch inline)
  function buildRowFromEvent(eventType, eventData, existing) {
    const base = existing || {};
    const now = eventData.serverTime || eventData.timestamp || new Date().toISOString();
    const isLogin = eventType === 'login';
    const isLogout = eventType === 'logout' || eventType === 'force';
    const isFailed = eventType === 'login_failed';

    return {
      ...base,
      id: eventData.sessionId,
      user_id: eventData.userId || base.user_id,
      user_name: eventData.userName || base.user_name,
      phone_number: eventData.phone || base.phone_number,
      ip_address: eventData.ipAddress || base.ip_address,
      user_agent: eventData.userAgent || base.user_agent,
      browser: eventData.browser || base.browser,
      os: eventData.os || base.os,
      branch_id: eventData.branchId || base.branch_id,
      action_type: isLogin ? 'LOGIN' : isFailed ? 'LOGIN_FAILED' : 'LOGOUT',
      status: isLogin ? 'active' : isFailed ? 'failed' : 'ended',
      login_time: isLogin ? now : base.login_time,
      logout_time: isLogout ? now : base.logout_time,
      last_activity_at: now,
      ...(isLogin ? { session_duration_seconds: null } : {}),
    };
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (sseRefetchTimerRef.current) {
        clearTimeout(sseRefetchTimerRef.current);
        sseRefetchTimerRef.current = null;
      }
    };
  }, []);

  const { connected } = useLoginSessionsSSE(handleSessionEvent, realtimeEnabled, token);

  const sessionTotalPages =
    sessions.data.total > 0 ? Math.ceil(sessions.data.total / (sessions.data.pageSize || 10)) : 1;
  const hasFilters =
    sessions.params.userName ||
    sessions.params.phone ||
    sessions.params.actionType ||
    sessions.params.status ||
    sessions.params.startDate ||
    sessions.params.endDate ||
    sessions.params.ipAddress ||
    sessions.params.sessionId ||
    sessions.params.branchId != null;

  function resetFilters() {
    // Xóa mọi điều kiện lọc + sessionId seed → trả về full danh sách
    sessions.setParams(() => ({
      userName: '',
      phone: '',
      actionType: '',
      status: '',
      startDate: '',
      endDate: '',
      branchId: undefined,
      ipAddress: '',
      sessionId: undefined,
      page: 1,
      pageSize: 10,
    }));
    setFocusedSessionId(null);
    focusScrollPendingRef.current = false;
  }

  const headerActions = (
    <div
      className="admin-page__header-actions"
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
    >
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.8rem',
          color: '#475569',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={realtimeEnabled}
          onChange={(e) => setRealtimeEnabled(e.target.checked)}
        />
        Cập nhật realtime
      </label>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={exporting}
        onClick={async () => {
          setExporting(true);
          setExportError(null);
          try {
            const blob = await auditApi.exportLoginSessions(sessions.params);
            downloadBlob(blob, 'login_sessions.xlsx');
          } catch (err) {
            setExportError(err?.message || 'Xuất Excel thất bại');
          } finally {
            setExporting(false);
          }
        }}
      >
        {exporting ? 'Đang xuất...' : 'Xuất Excel'}
      </button>
    </div>
  );

  return (
    <div className={`admin-page admin-sessions${embedded ? ' admin-page--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-page__header">
          <div className="admin-page__title-block">
            <div
              className="admin-page__title-icon"
              style={{
                background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                boxShadow: '0 6px 20px rgba(8, 145, 178, 0.35)',
              }}
            >
              <IconSession />
            </div>
            <div className="admin-page__title-group">
              <h1>Lịch sử đăng nhập</h1>
              <p className="admin-page__subtitle">
                Theo dõi tất cả lượt đăng nhập và đăng xuất trên hệ thống
              </p>
            </div>
          </div>
          {headerActions}
        </div>
      )}

      {embedded && <div className="admin-hub__toolbar">{headerActions}</div>}

      {exportError && (
        <div className="admin-page__error" style={{ marginBottom: 12 }}>
          {exportError}
        </div>
      )}

      {/* Stats Cards */}
      <StatsCards stats={sessions.data.stats} loading={sessions.loading} />

      {/* Filter Card */}
      <div className="admin-sessions__filters">
        <div className="admin-sessions__filter-header">
          <div className="admin-sessions__filter-title">
            <IconFilter />
            Bộ lọc &amp; Tìm kiếm
          </div>
        </div>

        <div className="admin-sessions__filter-body">
          <div className="filter-field">
            <label className="filter-field__label">Người dùng</label>
            <input
              className="filter-field__input"
              type="text"
              placeholder="Tên, email hoặc SĐT..."
              value={sessions.params.userName || ''}
              onChange={(e) => sessions.updateParam('userName', e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Địa chỉ IP</label>
            <input
              className="filter-field__input"
              type="text"
              placeholder="VD: 192.168..."
              value={sessions.params.ipAddress || ''}
              onChange={(e) => sessions.updateParam('ipAddress', e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Số điện thoại</label>
            <input
              className="filter-field__input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="0123-456-789"
              maxLength={PHONE_INPUT_MAX_LENGTH}
              value={formatPhoneInput(sessions.params.phone || '')}
              onChange={(e) =>
                sessions.updateParam('phone', phoneDigitsForSearch(e.target.value).slice(0, 11))
              }
            />
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Hành động</label>
            <select
              className="filter-field__select"
              value={sessions.params.actionType || ''}
              onChange={(e) => sessions.updateParam('actionType', e.target.value)}
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Trạng thái</label>
            <select
              className="filter-field__select"
              value={sessions.params.status || ''}
              onChange={(e) => sessions.updateParam('status', e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Chi nhánh</label>
            <select
              className="filter-field__select"
              value={sessions.params.branchId ?? ''}
              onChange={(e) =>
                sessions.updateParam(
                  'branchId',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              disabled={!!branchesError}
            >
              <option value="">
                {branchesError ? `Lỗi: ${branchesError}` : 'Tất cả chi nhánh'}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Khoảng ngày</label>
            <DateRangeInputs
              startDate={sessions.params.startDate || ''}
              endDate={sessions.params.endDate || ''}
              onChange={({ startDate, endDate }) => {
                sessions.setParams((p) => ({
                  ...p,
                  startDate,
                  endDate,
                  page: 1,
                }));
              }}
              className="filter-field__date-group"
              inputClassName="filter-field__input filter-field__input--date"
              sepClassName="filter-field__date-sep"
            />
          </div>
        </div>

        <div className="admin-sessions__filter-actions">
          <div className="admin-sessions__filter-results">
            {sessions.loading ? (
              <>Đang lọc...</>
            ) : (
              <>
                Tìm thấy <strong>{sessions.data.total}</strong> phiên đăng nhập
              </>
            )}
          </div>
          <div className="admin-sessions__filter-btns">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={resetFilters}
              disabled={!hasFilters && !sessions.loading}
              title="Xóa bộ lọc và tải lại danh sách đầy đủ"
            >
              <IconRefresh />
              Đặt lại
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="admin-sessions__table-card">
        <div className="admin-sessions__table-header">
          <div className="admin-sessions__table-title">
            <IconTable />
            Danh sách phiên đăng nhập
          </div>
        </div>

        {sessions.loading ? (
          <div className="admin-sessions__table-wrapper">
            <TableSkeleton rows={6} />
          </div>
        ) : sessions.error ? (
          <div className="admin-sessions__error">
            <strong>Lỗi:</strong> {sessions.error.message || 'Không thể tải danh sách'}
          </div>
        ) : (
          <>
            <div className="admin-sessions__table-wrapper">
              <SessionTable
                items={sessions.data.items}
                onViewSession={openSessionDetail}
                focusedSessionId={focusedSessionId}
              />
            </div>
            <Pagination
              currentPage={sessions.data.page || 1}
              totalPages={sessionTotalPages}
              total={sessions.data.total}
              onChange={(page) => sessions.updateParam('page', page)}
              loading={sessions.loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
