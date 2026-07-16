import { useState, useEffect } from 'react';
import { useAuditLogs } from '../../hooks/admin/useAuditLogs';
import { adminApi } from '../../services';
import UserDetailDrawer from './users/UserDetailDrawer';
import AuditLogDetailDrawer from './AuditLogDetailDrawer';
import AdminPagination from './components/AdminPagination';
import './AuditLogsPage.css';

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
];

const ACTION_LABELS = { CREATE: 'Tạo mới', UPDATE: 'Cập nhật', DELETE: 'Xóa' };
const ACTION_CLASS = { CREATE: 'badge--success', UPDATE: 'badge--info', DELETE: 'badge--danger' };

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

function getResponseBadge(status) {
  if (!status) return null;
  if (status >= 200 && status < 300) return { cls: 'badge--success', label: status };
  if (status >= 400 && status < 500) return { cls: 'badge--warning', label: status };
  if (status >= 500) return { cls: 'badge--danger', label: status };
  return { cls: 'badge--secondary', label: status };
}

function Pagination({ currentPage, totalPages, total, onChange, loading }) {
  return (
    <AdminPagination
      currentPage={currentPage}
      totalPages={totalPages}
      total={total}
      onChange={onChange}
      loading={loading}
      accent="indigo"
    />
  );
}

export default function AuditLogsPage() {
  const audit = useAuditLogs();
  const [branches, setBranches] = useState([]);
  const [branchesError, setBranchesError] = useState(null);
  // userId dang xem chi tiet (mo drawer user)
  const [detailUserId, setDetailUserId] = useState(null);
  // log dang xem chi tiet (mo drawer log)
  const [detailLog, setDetailLog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.adminBranchesApi.list();
        if (!cancelled) setBranches(res?.items || []);
      } catch (err) {
        if (!cancelled) setBranchesError(err.message || 'Không tải được chi nhánh');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function resetFilters() {
    audit.setParams(() => ({
      userName: '',
      phone: '',
      action: '',
      entityName: '',
      entityCode: '',
      startDate: '',
      endDate: '',
      branchId: undefined,
      page: 1,
      pageSize: 10,
    }));
  }

  const totalPages = audit.data.total > 0 ? Math.ceil(audit.data.total / (audit.data.pageSize || 10)) : 1;

  return (
    <div className="admin-logs">
      {/* Header */}
      <div className="admin-logs__header">
        <div className="admin-logs__title-block">
          <div className="admin-logs__title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div className="admin-logs__title-group">
            <h1>Nhật ký hoạt động</h1>
            <p className="admin-logs__subtitle">Theo dõi tất cả thao tác của người dùng trên hệ thống</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-row">
          <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo tên người dùng..."
            value={audit.params.userName || ''}
            onChange={(e) => audit.updateParam('userName', e.target.value)}
          />
          <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo số điện thoại..."
            value={audit.params.phone || ''}
            onChange={(e) => audit.updateParam('phone', e.target.value)}
          />
          <select
            className="input input--select"
            value={audit.params.action || ''}
            onChange={(e) => audit.updateParam('action', e.target.value)}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo mã (VD: ND-001)..."
            value={audit.params.entityCode || ''}
            onChange={(e) => audit.updateParam('entityCode', e.target.value)}
          />
          <input
            className="input input--date"
            type="date"
            value={audit.params.startDate || ''}
            onChange={(e) => audit.updateParam('startDate', e.target.value)}
            title="Từ ngày"
          />
          <input
            className="input input--date"
            type="date"
            value={audit.params.endDate || ''}
            onChange={(e) => audit.updateParam('endDate', e.target.value)}
            title="Đến ngày"
          />
          <select
            className="input input--select"
            value={audit.params.branchId ?? ''}
            onChange={(e) => audit.updateParam('branchId', e.target.value ? Number(e.target.value) : undefined)}
            disabled={!!branchesError}
          >
            <option value="">
              {branchesError ? `Lỗi: ${branchesError}` : 'Tất cả chi nhánh'}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.branchName}</option>
            ))}
          </select>
          <button className="btn btn--ghost" onClick={resetFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            Đặt lại
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {audit.loading ? (
          <div className="admin-logs__loading">Đang tải danh sách...</div>
        ) : audit.error ? (
          <div className="admin-logs__error">
            <strong>Lỗi:</strong> {audit.error.message || 'Không thể tải danh sách'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <AuditTable
                items={audit.data.items}
                onViewUser={setDetailUserId}
                onViewLog={setDetailLog}
              />
            </div>
            <Pagination
              currentPage={audit.data.page || 1}
              totalPages={totalPages}
              total={audit.data.total}
              onChange={(page) => audit.updateParam('page', page)}
              loading={audit.loading}
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

      {/* Log detail drawer */}
      {detailLog && (
        <AuditLogDetailDrawer
          log={detailLog}
          onClose={() => setDetailLog(null)}
        />
      )}
    </div>
  );
}

function AuditTable({ items, onViewUser, onViewLog }) {
  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Người dùng</th>
            <th>Hành động</th>
            <th>Bảng</th>
            <th>Mã / ID</th>
            <th>IP</th>
            <th>Phương thức</th>
            <th>Thời gian xử lý</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={10} className="table__empty">Không có nhật ký nào phù hợp với bộ lọc</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Người dùng</th>
          <th>Hành động</th>
          <th>Bảng</th>
          <th>Mã / ID</th>
          <th>IP</th>
          <th>Phương thức</th>
          <th>Thời gian xử lý</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const resp = getResponseBadge(item.response_status);
          return (
            <tr key={item.id}>
              <td className="admin-logs__date">{formatDate(item.logged_at)}</td>
              <td>
                <div className="admin-logs__user-cell">
                  <span className="admin-logs__user-name">{item.user_name || '—'}</span>
                  {item.phone_number && (
                    <span className="admin-logs__user-phone">{item.phone_number}</span>
                  )}
                </div>
              </td>
              <td>
                {item.action ? (
                  <span className={`badge ${ACTION_CLASS[item.action] || 'badge--secondary'}`}>
                    {ACTION_LABELS[item.action] || item.action}
                  </span>
                ) : '—'}
              </td>
              <td className="admin-logs__entity">{item.table_name || item.entity_name || '—'}</td>
              <td className="admin-logs__code">{item.entity_code || (item.record_id ? `#${item.record_id}` : '—')}</td>
              <td className="admin-logs__ip">{item.ip_address || '—'}</td>
              <td className="admin-logs__method">{item.request_method || '—'}</td>
              <td className="admin-logs__duration">{item.duration_ms != null ? `${item.duration_ms}ms` : '—'}</td>
              <td>
                {resp ? <span className={`badge ${resp.cls}`}>{resp.label}</span> : '—'}
              </td>
              <td>
                <div className="admin-logs__row-actions">
                  <button
                    type="button"
                    className="admin-logs__action-btn admin-logs__action-btn--primary"
                    onClick={() => onViewLog?.(item)}
                    title="Xem chi tiết nhật ký"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Log
                  </button>
                  {item.user_id && (
                    <button
                      type="button"
                      className="admin-logs__action-btn"
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
          );
        })}
      </tbody>
    </table>
  );
}