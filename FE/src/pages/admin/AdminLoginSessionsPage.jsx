import { useState, useEffect } from 'react';
import { useLoginSessions } from '../../hooks/admin/useLoginSessions';
import { adminBranchesApi } from '../../services/adminApi';
import UserDetailDrawer from './users/UserDetailDrawer';
import SessionDetailDrawer from './SessionDetailDrawer';
import AdminPagination from './components/AdminPagination';
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
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
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
  if (s > 0 && h === 0) parts.push(`${s} giây`); // chỉ hiện giây khi < 1 giờ
  return parts.join(' ') || '0 phút';
}

/** Tính "thời lượng hiện tại" của phiên active = now - login_time (giây) */
function liveDurationSeconds(loginTime) {
  if (!loginTime) return null;
  const t = new Date(loginTime).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

/** Hook: tick mỗi 30s để cập nhật duration cho phiên active (re-render bảng) */
function useDurationTicker(intervalMs = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

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

function SessionTable({ items, onViewUser, onViewSession }) {
  // Tick mỗi 30s để cập nhật "thời lượng hiện tại" của các phiên đang active
  useDurationTicker(30000);

  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thời gian đăng nhập</th>
            <th>Người dùng</th>
            <th className="col-hide-md">Số điện thoại</th>
            <th>Hành động</th>
            <th>Trạng thái</th>
            <th className="col-hide-md">IP</th>
            <th className="col-hide-md">Trình duyệt</th>
            <th className="col-hide-md">Thời lượng</th>
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
          <th className="col-hide-md">Số điện thoại</th>
          <th>Hành động</th>
          <th>Trạng thái</th>
          <th className="col-hide-md">IP</th>
          <th className="col-hide-md">Trình duyệt</th>
          <th className="col-hide-md">Thời lượng</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="admin-logs__date">{formatDate(item.login_time)}</td>
            <td className="admin-logs__user-name">{item.user_name || '—'}</td>
            <td className="admin-logs__phone col-hide-md">{item.phone_number || '—'}</td>
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
            <td className="admin-logs__ip col-hide-md">{item.ip_address || '—'}</td>
            <td className="admin-logs__user-agent col-hide-md" title={item.user_agent}>
              {item.user_agent ? (() => {
                const match = item.user_agent.match(/Chrome\/[\d.]+|Firefox\/[\d.]+|Safari\/[\d.]+/);
                return match ? match[0] : `${item.user_agent.slice(0, 30)}...`;
              })() : '—'}
            </td>
            <td className="admin-logs__duration col-hide-md">
              {item.status === 'active' ? (
                <span style={{ color: '#0891b2', fontWeight: 600 }} title="Đang hoạt động">
                  {formatDuration(liveDurationSeconds(item.login_time)) || '—'}
                </span>
              ) : (
                formatDuration(item.session_duration_seconds) || '—'
              )}
            </td>
            <td>
              <div className="admin-logs__row-actions">
                <button
                  type="button"
                  className="admin-logs__action-btn admin-logs__action-btn--primary"
                  onClick={() => onViewSession?.(item)}
                  title="Xem chi tiết phiên"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Phiên
                </button>
                {item.user_id && (
                <button
                  type="button"
                  className="admin-logs__action-btn admin-logs__action-btn--outline"
                  onClick={() => onViewUser?.(item.user_id)}
                  title="Xem chi tiết người dùng"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    User
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminLoginSessionsPage() {
  const sessions = useLoginSessions();
  const [branches, setBranches] = useState([]);
  const [branchesError, setBranchesError] = useState(null);
  // userId dang xem chi tiet (mo drawer user)
  const [detailUserId, setDetailUserId] = useState(null);
  // session dang xem chi tiet (mo drawer session)
  const [detailSession, setDetailSession] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminBranchesApi.list();
        if (!cancelled) setBranches(res?.items || []);
      } catch (err) {
        if (!cancelled) setBranchesError(err.message || 'Không tải được chi nhánh');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sessionTotalPages = sessions.data.total > 0 ? Math.ceil(sessions.data.total / (sessions.data.pageSize || 10)) : 1;

  return (
    <div className="admin-logs">
      <div className="admin-logs__header">
        <div className="admin-logs__title-block">
          <div className="admin-logs__title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="admin-logs__title-group">
            <h1>Lịch sử đăng nhập</h1>
            <p className="admin-logs__subtitle">Theo dõi tất cả lượt đăng nhập và đăng xuất trên hệ thống</p>
          </div>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-row">
          <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo tên người dùng..."
            value={sessions.params.userName || ''}
            onChange={(e) => sessions.updateParam('userName', e.target.value)}
          />
          <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo số điện thoại..."
            value={sessions.params.phone || ''}
            onChange={(e) => sessions.updateParam('phone', e.target.value)}
          />
          <select
            className="input input--select"
            value={sessions.params.actionType || ''}
            onChange={(e) => sessions.updateParam('actionType', e.target.value)}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="input input--select"
            value={sessions.params.status || ''}
            onChange={(e) => sessions.updateParam('status', e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            className="input input--date"
            type="date"
            value={sessions.params.startDate || ''}
            onChange={(e) => sessions.updateParam('startDate', e.target.value)}
            title="Từ ngày"
          />
          <input
            className="input input--date"
            type="date"
            value={sessions.params.endDate || ''}
            onChange={(e) => sessions.updateParam('endDate', e.target.value)}
            title="Đến ngày"
          />
          <select
            className="input input--select"
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
          <button className="btn btn--ghost" onClick={() => sessions.setParams(() => ({
            userName: '',
            phone: '',
            actionType: '',
            status: '',
            startDate: '',
            endDate: '',
            branchId: undefined,
            page: 1,
            pageSize: 10,
          }))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
            </svg>
            Đặt lại
          </button>
        </div>
      </div>

      <div className="table-card">
        {sessions.loading ? (
          <div className="admin-logs__loading">Đang tải danh sách...</div>
        ) : sessions.error ? (
          <div className="admin-logs__error">
            <strong>Lỗi:</strong> {sessions.error.message || 'Không thể tải danh sách'}
          </div>
        ) : (
          <>
            <SessionTable
              items={sessions.data.items}
              onViewUser={setDetailUserId}
              onViewSession={setDetailSession}
            />
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

      {detailUserId && (
        <UserDetailDrawer
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
        />
      )}

      {detailSession && (
        <SessionDetailDrawer
          session={detailSession}
          onClose={() => setDetailSession(null)}
        />
      )}
    </div>
  );
}
