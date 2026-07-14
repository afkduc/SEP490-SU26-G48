import { useState, useEffect } from 'react';
import { useLoginSessions } from '../../hooks/admin/useLoginSessions';
import { adminLoginSessionsApi, adminBranchesApi } from '../../services/adminApi';
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
  if (seconds === undefined || seconds === null) return '—';
  if (seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function Pagination({ currentPage, totalPages, total, onChange, loading }) {
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span className="pagination__info">
        Tổng <strong>{total}</strong> bản ghi
        &nbsp;— Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
      </span>
      <div className="pagination__controls">
        <button className="pagination__nav-btn" onClick={() => onChange(currentPage - 1)} disabled={currentPage <= 1 || loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Trước
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let pageNum;
          if (totalPages <= 7) pageNum = i + 1;
          else if (currentPage <= 4) pageNum = i + 1;
          else if (currentPage >= totalPages - 3) pageNum = totalPages - 6 + i;
          else pageNum = currentPage - 3 + i;
          return (
            <button
              key={pageNum}
              className={`pagination__page-btn ${currentPage === pageNum ? 'active' : ''}`}
              onClick={() => onChange(pageNum)}
              disabled={loading}
            >
              {pageNum}
            </button>
          );
        })}
        <button className="pagination__nav-btn" onClick={() => onChange(currentPage + 1)} disabled={currentPage >= totalPages || loading}>
          Sau
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SessionTable({ items }) {
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
            <th>Thời gian đăng xuất</th>
            <th>Thời lượng</th>
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
          <th>Thời gian đăng xuất</th>
          <th>Thời lượng</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="admin-logs__date">{formatDate(item.login_time)}</td>
            <td className="admin-logs__user-name">{item.user_name || '—'}</td>
            <td className="admin-logs__phone">{item.phone_number || '—'}</td>
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
            <td className="admin-logs__ip">{item.ip_address || '—'}</td>
            <td className="admin-logs__user-agent" title={item.user_agent}>
              {item.user_agent ? (() => {
                const match = item.user_agent.match(/Chrome\/[\d.]+|Firefox\/[\d.]+|Safari\/[\d.]+/);
                return match ? match[0] : `${item.user_agent.slice(0, 30)}...`;
              })() : '—'}
            </td>
            <td className="admin-logs__date">{formatDate(item.logout_time)}</td>
            <td className="admin-logs__duration">{formatDuration(item.session_duration_seconds)}</td>
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

  const sessionTotalPages = sessions.data.total > 0 ? Math.ceil(sessions.data.total / (sessions.data.pageSize || 20)) : 1;

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
            <h1>Thiết bị đăng nhập</h1>
            <p className="admin-logs__subtitle">Theo dõi các thiết bị đã đăng nhập vào hệ thống</p>
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
            pageSize: 20,
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
            <div style={{ overflowX: 'auto' }}>
              <SessionTable items={sessions.data.items} />
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
