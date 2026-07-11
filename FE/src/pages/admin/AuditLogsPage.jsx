import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuditLogs } from '../../hooks/admin/useAuditLogs';
import { useLoginSessions } from '../../hooks/admin/useLoginSessions';
import { auditApi, adminApi } from '../../services';
import './AuditLogsPage.css';

const ACTION_OPTIONS = [
  { value: '', label: 'Tat ca hanh dong' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
];

const ACTION_LABELS = { CREATE: 'Tao moi', UPDATE: 'Cap nhat', DELETE: 'Xoa' };
const ACTION_CLASS = { CREATE: 'badge--success', UPDATE: 'badge--info', DELETE: 'badge--danger' };

const LOGIN_ACTION_OPTIONS = [
  { value: '', label: 'Tat ca hanh dong' },
  { value: 'LOGIN', label: 'Dang nhap' },
  { value: 'LOGIN_FAILED', label: 'Dang nhap that bai' },
];

const LOGIN_ACTION_CLASS = { LOGIN: 'badge--success', LOGIN_FAILED: 'badge--danger' };
const LOGIN_ACTION_LABEL = { LOGIN: 'Dang nhap', LOGIN_FAILED: 'That bai' };

const SESSION_STATUS_OPTIONS = [
  { value: '', label: 'Tat ca trang thai' },
  { value: 'active', label: 'Dang hoat dong' },
  { value: 'ended', label: 'Da dang xuat' },
  { value: 'failed', label: 'That bai' },
];

const SESSION_STATUS_CLASS = { active: 'badge--success', ended: 'badge--secondary', failed: 'badge--danger' };
const SESSION_STATUS_LABEL = { active: 'Dang hoat dong', ended: 'Da dang xuat', failed: 'That bai' };

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getResponseBadge(status) {
  if (!status) return null;
  if (status >= 200 && status < 300) return { cls: 'badge--success', label: status };
  if (status >= 400 && status < 500) return { cls: 'badge--warning', label: status };
  if (status >= 500) return { cls: 'badge--danger', label: status };
  return { cls: 'badge--secondary', label: status };
}

function Pagination({ currentPage, totalPages, total, onChange, loading }) {
  if (total === 0) return null;

  function handlePageChange(page) {
    if (page < 1 || page > totalPages || loading) return;
    onChange(page);
  }

  return (
    <div className="pagination">
      <span className="pagination__info">
        Tong <strong>{total}</strong> ban ghi
        &nbsp;— Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
      </span>
      <div className="pagination__controls">
        <button
          className="pagination__nav-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Truoc
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
              onClick={() => handlePageChange(pageNum)}
              disabled={loading}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          className="pagination__nav-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
        >
          Sau
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'login' ? 'login' : 'audit';

  const [activeTab, setActiveTab] = useState(initialTab);

  const audit = useAuditLogs();
  const sessions = useLoginSessions();

  const [branches, setBranches] = useState([]);
  const [branchesError, setBranchesError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.adminBranchesApi.list();
        if (!cancelled) setBranches(res?.items || []);
      } catch (err) {
        if (!cancelled) setBranchesError(err.message || 'Khong tai duoc chi nhanh');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function resetFilters() {
    if (activeTab === 'audit') {
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
        pageSize: 20,
      }));
    } else {
      sessions.setParams(() => ({
        userName: '',
        phone: '',
        actionType: '',
        status: '',
        startDate: '',
        endDate: '',
        branchId: undefined,
        page: 1,
        pageSize: 20,
      }));
    }
  }

  function switchTab(tab) {
    setActiveTab(tab);
  }

  const auditTotalPages = audit.data.total > 0 ? Math.ceil(audit.data.total / (audit.data.pageSize || 20)) : 1;
  const sessionTotalPages = sessions.data.total > 0 ? Math.ceil(sessions.data.total / (sessions.data.pageSize || 20)) : 1;

  const isAudit = activeTab === 'audit';
  const currentData = isAudit ? audit.data : sessions.data;
  const currentLoading = isAudit ? audit.loading : sessions.loading;
  const currentError = isAudit ? audit.error : sessions.error;
  const currentParams = isAudit ? audit.params : sessions.params;
  const currentUpdateParam = isAudit ? audit.updateParam : sessions.updateParam;
  const currentTotalPages = isAudit ? auditTotalPages : sessionTotalPages;

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
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div className="admin-logs__title-group">
            <h1>Nhat ky he thong</h1>
            <p className="admin-logs__subtitle">Theo doi tat ca hoat dong va lich su dang nhap</p>
          </div>
        </div>
        <div className="admin-logs__actions">
          {currentData.total > 0 && (
            <span className="admin-logs__total-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {currentData.total} ban ghi
            </span>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="admin-logs__tab-bar">
        <button
          className={`admin-logs__tab-btn ${isAudit ? 'admin-logs__tab-btn--active' : ''}`}
          onClick={() => switchTab('audit')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Nhat ky hoat dong
        </button>
        <button
          className={`admin-logs__tab-btn ${!isAudit ? 'admin-logs__tab-btn--active' : ''}`}
          onClick={() => switchTab('login')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Lich su dang nhap
        </button>
      </div>

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-row">
          <input
            className="input input--search"
            type="text"
            placeholder="Tim theo ten nguoi dung..."
            value={currentParams.userName || ''}
            onChange={(e) => currentUpdateParam('userName', e.target.value)}
          />
          <input
            className="input input--search"
            type="text"
            placeholder="Tim theo so dien thoai..."
            value={currentParams.phone || ''}
            onChange={(e) => currentUpdateParam('phone', e.target.value)}
          />

          {isAudit ? (
            <>
              <select
                className="input input--select"
                value={currentParams.action || ''}
                onChange={(e) => currentUpdateParam('action', e.target.value)}
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                className="input input--search"
                type="text"
                placeholder="Tim theo ma (VD: ND-001)..."
                value={currentParams.entityCode || ''}
                onChange={(e) => currentUpdateParam('entityCode', e.target.value)}
              />
            </>
          ) : (
            <>
              <select
                className="input input--select"
                value={currentParams.actionType || ''}
                onChange={(e) => currentUpdateParam('actionType', e.target.value)}
              >
                {LOGIN_ACTION_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                className="input input--select"
                value={currentParams.status || ''}
                onChange={(e) => currentUpdateParam('status', e.target.value)}
              >
                {SESSION_STATUS_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </>
          )}

          <input
            className="input input--date"
            type="date"
            value={currentParams.startDate || ''}
            onChange={(e) => currentUpdateParam('startDate', e.target.value)}
            title="Tu ngay"
          />
          <input
            className="input input--date"
            type="date"
            value={currentParams.endDate || ''}
            onChange={(e) => currentUpdateParam('endDate', e.target.value)}
            title="Den ngay"
          />

          <select
            className="input input--select"
            value={currentParams.branchId ?? ''}
            onChange={(e) =>
              currentUpdateParam('branchId', e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={!!branchesError}
          >
            <option value="">
              {branchesError ? `Loi: ${branchesError}` : 'Tat ca chi nhanh'}
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
            Dat lai
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-card__header">
          <div className="table-card__title">
            {isAudit ? 'Nhat ky hoat dong' : 'Lich su dang nhap'}
          </div>
        </div>

        {currentLoading ? (
          <div className="admin-logs__loading">Dang tai danh sach...</div>
        ) : currentError ? (
          <div className="admin-logs__error">
            <strong>Loi:</strong> {currentError.message || 'Khong the tai danh sach'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              {isAudit ? <AuditTable items={currentData.items} /> : <SessionTable items={currentData.items} />}
            </div>

            <Pagination
              currentPage={currentData.page || 1}
              totalPages={currentTotalPages}
              total={currentData.total}
              onChange={(page) => currentUpdateParam('page', page)}
              loading={currentLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Audit Log Table ─── */
function AuditTable({ items }) {
  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thoi gian</th>
            <th>Nguoi dung</th>
            <th>Hanh dong</th>
            <th>Bang</th>
            <th>Ma / ID</th>
            <th>IP</th>
            <th>Phuong thuc</th>
            <th>Thoi gian xu ly</th>
            <th>Trang thai</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={9} className="table__empty">
              Khong co nhat ky nao phu hop voi bo loc
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
          <th>Thoi gian</th>
          <th>Nguoi dung</th>
          <th>Hanh dong</th>
          <th>Bang</th>
          <th>Ma / ID</th>
          <th>IP</th>
          <th>Phuong thuc</th>
          <th>Thoi gian xu ly</th>
          <th>Trang thai</th>
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
              <td className="admin-logs__code">
                {item.entity_code || (item.record_id ? `#${item.record_id}` : '—')}
              </td>
              <td className="admin-logs__ip">{item.ip_address || '—'}</td>
              <td className="admin-logs__method">{item.request_method || '—'}</td>
              <td className="admin-logs__duration">
                {item.duration_ms != null ? `${item.duration_ms}ms` : '—'}
              </td>
              <td>
                {resp ? (
                  <span className={`badge ${resp.cls}`}>{resp.label}</span>
                ) : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── Login Session Table ─── */
function SessionTable({ items }) {
  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thoi gian dang nhap</th>
            <th>Nguoi dung</th>
            <th>So dien thoai</th>
            <th>Hanh dong</th>
            <th>Trang thai</th>
            <th>IP</th>
            <th>Trinh duyet</th>
            <th>Thoi gian dang xuat</th>
            <th>Thoi luong</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={9} className="table__empty">
              Khong co lich su dang nhap nao phu hop voi bo loc
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
          <th>Thoi gian dang nhap</th>
          <th>Nguoi dung</th>
          <th>So dien thoai</th>
          <th>Hanh dong</th>
          <th>Trang thai</th>
          <th>IP</th>
          <th>Trinh duyet</th>
          <th>Thoi gian dang xuat</th>
          <th>Thoi luong</th>
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
                <span className={`badge ${LOGIN_ACTION_CLASS[item.action_type] || 'badge--secondary'}`}>
                  {LOGIN_ACTION_LABEL[item.action_type] || item.action_type}
                </span>
              ) : '—'}
            </td>
            <td>
              {item.status ? (
                <span className={`badge ${SESSION_STATUS_CLASS[item.status] || 'badge--secondary'}`}>
                  {SESSION_STATUS_LABEL[item.status] || item.status}
                </span>
              ) : '—'}
            </td>
            <td className="admin-logs__ip">{item.ip_address || '—'}</td>
            <td className="admin-logs__user-agent" title={item.user_agent}>
              {item.user_agent
                ? (() => {
                    const match = item.user_agent.match(/Chrome\/[\d.]+|Firefox\/[\d.]+|Safari\/[\d.]+/);
                    return match ? match[0] : item.user_agent.slice(0, 30) + '...';
                  })()
                : '—'}
            </td>
            <td className="admin-logs__date">{formatDate(item.logout_time)}</td>
            <td className="admin-logs__duration">{formatDuration(item.session_duration_seconds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
