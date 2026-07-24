import { useState, useEffect, useRef } from 'react';
import { useLoginSessions } from '../../hooks/admin/useLoginSessions';
import { useLoginSessionsSSE } from '../../hooks/admin/useLoginSessionsSSE';
import { useSharedBranches } from '../../contexts/SharedDataContext';
import { useAuth } from '../../contexts/AppContext';
import UserDetailDrawer from './users/UserDetailDrawer';
import SessionDetailDrawer from './SessionDetailDrawer';
import AdminPagination from './components/AdminPagination';
import { formatDateSafe } from '../../utils/dateUtils';
import './LoginSessionsPage.css';

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'LOGIN', label: 'Đăng nhập' },
  { value: 'LOGIN_FAILED', label: 'Đăng nhập thất bại' },
];

const ACTION_CLASS = { LOGIN: 'badge--success', LOGIN_FAILED: 'badge--danger' };
const ACTION_LABEL = { LOGIN: 'Đăng nhập', LOGIN_FAILED: 'Thất bại' };

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'ended', label: 'Đã đăng xuất' },
  { value: 'failed', label: 'Thất bại' },
];

const STATUS_CLASS = { active: 'badge--success', ended: 'badge--secondary', failed: 'badge--danger' };
const STATUS_LABEL = { active: 'Đang hoạt động', ended: 'Đã đăng xuất', failed: 'Thất bại' };

function formatDate(value) {
  // Su dung formatDateSafe de parse an toan va hien thi VN timezone
  // (khop voi server tra ve UTC). Cu: khong co timeZone nen dung browser local.
  return formatDateSafe(value, {
    timeZone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    withSeconds: true,
  });
}

function renderBrowser(item) {
  if (item.browser && item.os) {
    return (
      <span>
        <strong>{item.browser}</strong>
        <span style={{ color: '#64748b' }}> · {item.os}</span>
      </span>
    );
  }
  if (item.browser) {
    return <strong>{item.browser}</strong>;
  }
  if (!item.user_agent) return '—';
  const match = item.user_agent.match(/(Edge|Edg|Chrome|Firefox|Safari|OPR|Opera)[\/ ]?([\d.]+)/i);
  if (match) {
    const name = match[1] === 'Edg' ? 'Edge' : match[1];
    return <span><strong>{name}</strong> {match[2]}</span>;
  }
  return item.user_agent.slice(0, 30);
}

function formatDuration(seconds) {
  if (seconds === undefined || seconds === null) return null;
  if (seconds < 0) return null;
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} giờ`);
  if (remM > 0) parts.push(`${remM} phút`);
  if (s > 0 && h === 0) parts.push(`${s} giây`);
  return parts.join(' ') || '0 phút';
}

function liveDurationSeconds(loginTime) {
  if (!loginTime) return null;
  const t = new Date(loginTime).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

function useDurationTicker(intervalMs = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

// ─── Icons ────────────────────────────────────────────────────────────

const IconSession = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconFilter = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconTable = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

const IconTotal = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const IconLogin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    <polyline points="10 17 15 12 10 7"/>
    <line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);

const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconActive = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconFailed = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

// ─── Stats Cards ────────────────────────────────────────────────────

function StatsCards({ stats, loading }) {
  const counts = stats || { total: 0, loginCount: 0, failedCount: 0, activeCount: 0 };

  const cards = [
    { icon: <IconTotal />, iconCls: 'stat-card__icon--gray', value: counts.total, label: 'Tổng phiên' },
    { icon: <IconLogin />, iconCls: 'stat-card__icon--green', value: counts.loginCount, label: 'Đăng nhập thành công' },
    { icon: <IconActive />, iconCls: 'stat-card__icon--cyan', value: counts.activeCount, label: 'Đang hoạt động' },
    { icon: <IconFailed />, iconCls: 'stat-card__icon--red', value: counts.failedCount, label: 'Thất bại' },
  ];

  return (
    <div className="admin-sessions__stats">
      {cards.map((c, i) => (
        <div key={i} className="stat-card">
          <div className={`stat-card__icon ${c.iconCls}`}>{c.icon}</div>
          <div className="stat-card__content">
            <span className="stat-card__value">
              {loading ? '—' : c.value}
            </span>
            <span className="stat-card__label">{c.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, total, onChange, loading }) {
  return (
    <AdminPagination
      currentPage={currentPage}
      totalPages={totalPages}
      total={total}
      onChange={onChange}
      loading={loading}
      accent="cyan"
    />
  );
}

// ─── Table Skeleton ────────────────────────────────────────────────

function TableSkeleton({ rows }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Thời gian đăng nhập</th>
          <th>Người dùng</th>
          <th>Số điện thoại</th>
          <th>Hành động</th>
          <th>Trạng thái</th>
          <th>IP</th>
          <th>Trình duyệt</th>
          <th>Thời lượng</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {[...Array(9)].map((_, j) => (
              <td key={j}>
                <div className="skeleton-line" style={{ width: `${50 + Math.random() * 40}%` }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Session Table ─────────────────────────────────────────────────

function SessionTable({ items, onViewUser, onViewSession }) {
  useDurationTicker(30000);

  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thời gian đăng nhập</th>
            <th>Người dùng</th>
            <th>Số điện thoại</th>
            <th>Hành động</th>
            <th>Trạng thái</th>
            <th>IP</th>
            <th>Trình duyệt</th>
            <th>Thời lượng</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={9} className="table__empty">
              Không có lịch sử đăng nhập nào phù hợp với bộ lọc
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Thời gian đăng nhập</th>
          <th>Người dùng</th>
          <th>Số điện thoại</th>
          <th>Hành động</th>
          <th>Trạng thái</th>
          <th>IP</th>
          <th>Trình duyệt</th>
          <th>Thời lượng</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="admin-sessions__date">{formatDate(item.login_time)}</td>
            <td className="admin-sessions__user-name">{item.user_name || '—'}</td>
            <td className="admin-sessions__phone">{item.phone_number || '—'}</td>
            <td>
              {item.action_type ? (
                <span className={`badge ${ACTION_CLASS[item.action_type] || 'badge--secondary'}`}>
                  {ACTION_LABEL[item.action_type] || item.action_type}
                </span>
              ) : '—'}
            </td>
            <td>
              {item.status ? (
                <span className={`badge ${STATUS_CLASS[item.status] || 'badge--secondary'}`}>
                  {STATUS_LABEL[item.status] || item.status}
                </span>
              ) : '—'}
            </td>
            <td className="admin-sessions__ip">{item.ip_address || '—'}</td>
            <td className="admin-sessions__user-agent" title={item.user_agent || ''}>
              {renderBrowser(item)}
            </td>
            <td className="admin-sessions__duration">
              {item.status === 'active' ? (
                <span style={{ color: '#0891b2', fontWeight: 600 }}>
                  {formatDuration(liveDurationSeconds(item.login_time)) || '—'}
                </span>
              ) : (
                formatDuration(item.session_duration_seconds) || '—'
              )}
            </td>
            <td>
              <div className="admin-sessions__row-actions">
                <button
                  type="button"
                  className="admin-sessions__action-btn admin-sessions__action-btn--primary"
                  onClick={() => onViewSession?.(item)}
                  title="Xem chi tiết phiên"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Chi tiết
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminLoginSessionsPage() {
  const sessions = useLoginSessions();
  const { branches, branchesError } = useSharedBranches();
  const { token } = useAuth();
  const [detailUserId, setDetailUserId] = useState(null);
  const [detailSession, setDetailSession] = useState(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

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

  // SSE: smart refetch thay vi full refetch moi event.
  // - Neu filter dang nhu "user X" va event khong phai user X -> bo qua.
  // - Neu chi co action_type filter va event khong match -> bo qua.
  // - Debounce 500ms de gom nhieu event.
  const handleSessionEvent = (eventData) => {
    const eventType = eventData && eventData.type;
    const sessionUserName = eventData && eventData.userName;
    const sessionUserId = eventData && eventData.userId;

    // Filter matching (de khong refetch khi event khong thuoc filter hien tai)
    const p = paramsRef.current;
    const filterUserName = (p.userName || '').toLowerCase().trim();
    const filterActionType = p.actionType || '';
    const filterStatus = p.status || '';
    const filterBranchId = p.branchId;

    if (filterUserName && sessionUserName) {
      if (!String(sessionUserName).toLowerCase().includes(filterUserName)) {
        return; // Khong match filter -> bo qua
      }
    }
    if (filterActionType && eventType) {
      const actionMap = { login: 'LOGIN', logout: 'LOGOUT', force: 'FORCE_LOGOUT', login_failed: 'LOGIN_FAILED' };
      const expectedAction = actionMap[eventType] || eventType.toUpperCase();
      if (filterActionType !== expectedAction && filterActionType !== eventType) {
        return; // Khong match action filter
      }
    }
    if (filterStatus) {
      const statusByEvent = { login: 'active', logout: 'ended', force: 'ended', login_failed: 'failed' };
      const eventStatus = statusByEvent[eventType];
      if (eventStatus && filterStatus !== eventStatus) return;
    }
    // void for future use
    void sessionUserId;
    void filterBranchId;

    // Debounce: gom nhieu event trong 500ms thanh 1 lan refetch
    if (sseRefetchTimerRef.current) {
      clearTimeout(sseRefetchTimerRef.current);
    }
    sseRefetchTimerRef.current = setTimeout(() => {
      sessions.refetch();
      sseRefetchTimerRef.current = null;
    }, 500);
  };

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

  const sessionTotalPages = sessions.data.total > 0 ? Math.ceil(sessions.data.total / (sessions.data.pageSize || 10)) : 1;
  const hasFilters = sessions.params.userName || sessions.params.phone ||
    sessions.params.actionType || sessions.params.status ||
    sessions.params.startDate || sessions.params.endDate ||
    (sessions.params.branchId != null);

  function resetFilters() {
    sessions.setParams(() => ({
      userName: '',
      phone: '',
      actionType: '',
      status: '',
      startDate: '',
      endDate: '',
      branchId: undefined,
      page: 1,
      pageSize: 10,
    }));
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <div className="admin-page__title-icon" style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)', boxShadow: '0 6px 20px rgba(8, 145, 178, 0.35)' }}>
            <IconSession />
          </div>
          <div className="admin-page__title-group">
            <h1>Lịch sử đăng nhập</h1>
            <p className="admin-page__subtitle">Theo dõi tất cả lượt đăng nhập và đăng xuất trên hệ thống</p>
          </div>
        </div>
        <div className="admin-page__header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={realtimeEnabled}
              onChange={(e) => setRealtimeEnabled(e.target.checked)}
            />
            Cập nhật realtime
          </label>
        </div>
      </div>

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
            <label className="filter-field__label">Tên người dùng</label>
            <input
              className="filter-field__input"
              type="text"
              placeholder="Nhập tên người dùng..."
              value={sessions.params.userName || ''}
              onChange={(e) => sessions.updateParam('userName', e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Số điện thoại</label>
            <input
              className="filter-field__input"
              type="text"
              placeholder="Nhập SĐT..."
              value={sessions.params.phone || ''}
              onChange={(e) => sessions.updateParam('phone', e.target.value)}
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
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
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
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Chi nhánh</label>
            <select
              className="filter-field__select"
              value={sessions.params.branchId ?? ''}
              onChange={(e) => sessions.updateParam('branchId', e.target.value ? Number(e.target.value) : undefined)}
              disabled={!!branchesError}
            >
              <option value="">
                {branchesError ? `Lỗi: ${branchesError}` : 'Tất cả chi nhánh'}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branchName}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label className="filter-field__label">Khoảng ngày</label>
            <div className="filter-field__date-group">
              <input
                className="filter-field__input filter-field__input--date"
                type="date"
                value={sessions.params.startDate || ''}
                onChange={(e) => sessions.updateParam('startDate', e.target.value)}
                title="Từ ngày"
              />
              <span className="filter-field__date-sep">—</span>
              <input
                className="filter-field__input filter-field__input--date"
                type="date"
                value={sessions.params.endDate || ''}
                onChange={(e) => sessions.updateParam('endDate', e.target.value)}
                title="Đến ngày"
              />
            </div>
          </div>
        </div>

        <div className="admin-sessions__filter-actions">
          <div className="admin-sessions__filter-results">
            {sessions.data.total > 0 && (
              <>Tìm thấy <strong>{sessions.data.total}</strong> phiên đăng nhập</>
            )}
          </div>
          <div className="admin-sessions__filter-btns">
            {hasFilters && (
              <button className="btn btn--ghost btn--sm" onClick={resetFilters}>
                <IconRefresh />
                Đặt lại
              </button>
            )}
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
                onViewUser={setDetailUserId}
                onViewSession={setDetailSession}
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

      {/* User detail drawer */}
      {detailUserId && (
        <UserDetailDrawer
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
        />
      )}

      {/* Session detail drawer */}
      {detailSession && (
        <SessionDetailDrawer
          session={detailSession}
          onClose={() => setDetailSession(null)}
        />
      )}
    </div>
  );
}
