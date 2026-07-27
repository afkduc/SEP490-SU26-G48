import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminSecurityAlertsApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import AdminPagination from './components/AdminPagination';
import './AdminShared.css';
import './AdminSecurityAlertsPage.css';

const SEVERITY_OPTIONS = [
  { value: '', label: 'Tất cả mức độ' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'info', label: 'Info' },
];

const ACK_OPTIONS = [
  { value: 'false', label: 'Chưa xử lý' },
  { value: 'true', label: 'Đã xử lý' },
  { value: '', label: 'Tất cả' },
];

const SEVERITY_LABEL = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  info: 'Info',
};

const RULE_LABEL = {
  failed_login_burst: 'Đăng nhập sai liên tiếp',
  new_admin_role: 'Gán quyền Admin',
  inactive_admin: 'Admin không hoạt động',
  new_device_ip: 'IP/thiết bị mới',
};

function formatDateTime(value) {
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
    return String(value);
  }
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function AdminSecurityAlertsPage({ embedded = false } = {}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, critical: 0, high: 0, medium: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ackingId, setAckingId] = useState(null);
  const [severity, setSeverity] = useState('');
  const [isAcknowledged, setIsAcknowledged] = useState('false');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadCounts = useCallback(async () => {
    try {
      const data = await adminSecurityAlertsApi.getCounts();
      setCounts(data || { total: 0, critical: 0, high: 0, medium: 0, info: 0 });
    } catch {
      /* ignore */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, pageSize };
      if (severity) params.severity = severity;
      if (isAcknowledged !== '') params.isAcknowledged = isAcknowledged;
      const data = await adminSecurityAlertsApi.list(params);
      setItems(data?.items || []);
      setTotal(Number(data?.total) || 0);
    } catch (err) {
      setError(err?.message || 'Không tải được cảnh báo bảo mật');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, severity, isAcknowledged]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleAck(id) {
    setAckingId(id);
    try {
      await adminSecurityAlertsApi.ack(id);
      toast.success('Đã đánh dấu xử lý cảnh báo');
      await Promise.all([loadList(), loadCounts()]);
    } catch (err) {
      toast.error(err?.message || 'Không thể xử lý cảnh báo');
    } finally {
      setAckingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={`admin-page admin-security-alerts${embedded ? ' admin-security-alerts--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-page__header">
          <div className="admin-page__title-block">
            <div className="admin-page__title-icon">
              <IconShield />
            </div>
            <div className="admin-page__title-group">
              <h1>Cảnh báo bảo mật</h1>
              <p className="admin-page__subtitle">Theo dõi và xử lý các sự kiện bảo mật bất thường</p>
            </div>
          </div>
          <div className="admin-page__actions">
            <span className="admin-page__total-badge">{total} kết quả</span>
          </div>
        </div>
      )}

      {embedded && (
        <div className="admin-hub__toolbar">
          <span className="admin-page__total-badge">{total} kết quả</span>
        </div>
      )}

      <div className="sec-alert-summary">
        <div className="sec-alert-summary__card sec-alert-summary__card--critical">
          <span className="sec-alert-summary__label">Critical</span>
          <strong>{counts.critical || 0}</strong>
        </div>
        <div className="sec-alert-summary__card sec-alert-summary__card--high">
          <span className="sec-alert-summary__label">High</span>
          <strong>{counts.high || 0}</strong>
        </div>
        <div className="sec-alert-summary__card sec-alert-summary__card--medium">
          <span className="sec-alert-summary__label">Medium</span>
          <strong>{counts.medium || 0}</strong>
        </div>
        <div className="sec-alert-summary__card sec-alert-summary__card--info">
          <span className="sec-alert-summary__label">Info</span>
          <strong>{counts.info || 0}</strong>
        </div>
        <div className="sec-alert-summary__card">
          <span className="sec-alert-summary__label">Chưa xử lý</span>
          <strong>{counts.total || 0}</strong>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
          <select
            className="form-select"
            value={severity}
            onChange={(e) => { setPage(1); setSeverity(e.target.value); }}
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={isAcknowledged}
            onChange={(e) => { setPage(1); setIsAcknowledged(e.target.value); }}
          >
            {ACK_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="button" className="btn btn--secondary" onClick={() => { loadList(); loadCounts(); }}>
            Làm mới
          </button>
        </div>
      </div>

      {loading && (
        <div className="admin-page__loading">Đang tải cảnh báo...</div>
      )}
      {error && !loading && (
        <div className="admin-page__error">{error}</div>
      )}

      {!loading && !error && (
        <div className="admin-table-card">
          {items.length === 0 ? (
            <div className="admin-page__empty">Không có cảnh báo phù hợp bộ lọc</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mức</th>
                  <th>Tiêu đề</th>
                  <th>Rule</th>
                  <th>User</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <span className={`sec-sev sec-sev--${alert.severity || 'info'}`}>
                        {SEVERITY_LABEL[alert.severity] || alert.severity || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="sec-alert-title">{alert.title}</div>
                      <div className="sec-alert-msg">{alert.message}</div>
                    </td>
                    <td>{RULE_LABEL[alert.ruleKey] || alert.ruleKey || '—'}</td>
                    <td>
                      {alert.userId ? (
                        <button
                          type="button"
                          className="sec-user-link"
                          onClick={() => navigate(`/admin/users?search=${encodeURIComponent(alert.userName || '')}`)}
                        >
                          {alert.displayName || alert.userName || `#${alert.userId}`}
                        </button>
                      ) : '—'}
                    </td>
                    <td>{formatDateTime(alert.createdAt)}</td>
                    <td>
                      {alert.isAcknowledged ? (
                        <span className="badge badge--success">Đã xử lý</span>
                      ) : (
                        <span className="badge badge--danger">Chưa xử lý</span>
                      )}
                      {alert.isAcknowledged && alert.acknowledgedByName && (
                        <div className="sec-ack-meta">
                          bởi {alert.acknowledgedByName}
                          <br />
                          {formatDateTime(alert.acknowledgedAt)}
                        </div>
                      )}
                    </td>
                    <td>
                      {!alert.isAcknowledged && (
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={ackingId === alert.id}
                          onClick={() => handleAck(alert.id)}
                        >
                          {ackingId === alert.id ? '...' : 'Đã xử lý'}
                        </button>
                      )}
                      {alert.userId && (
                        <Link
                          className="btn btn--secondary btn--sm"
                          to="/admin/login-security?tab=sessions"
                          style={{ marginLeft: 6 }}
                        >
                          Xem login
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <AdminPagination
              currentPage={page}
              totalPages={totalPages}
              total={total}
              onChange={setPage}
              loading={loading}
            />
          )}
        </div>
      )}
    </div>
  );
}
