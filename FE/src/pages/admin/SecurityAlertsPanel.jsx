import { useCallback, useEffect, useState } from 'react';
import { adminSecurityAlertsApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import { parseAlertMeta } from './securityAlertFocus';
import './SecurityAlertsPanel.css';

const RULE_LABEL = {
  failed_login_burst: 'Đăng nhập sai liên tiếp',
  new_admin_role: 'Gán quyền Admin',
  inactive_admin: 'Admin không hoạt động',
  new_device_ip: 'IP/thiết bị mới',
};

const SEVERITY_LABEL = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  info: 'Info',
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

function canFocusDevice(alert) {
  if (!alert) return false;
  if (alert.userId) return true;
  const meta = parseAlertMeta(alert.metadata);
  return Boolean(meta.ipAddress || meta.ip);
}

function canOpenSessions(alert) {
  return canFocusDevice(alert);
}

/**
 * Panel phụ trên tab Thiết bị — tín hiệu cảnh báo, không phải chỗ force logout.
 */
export default function SecurityAlertsPanel({
  expanded,
  onExpandedChange,
  onFocusDevice,
  onOpenSessions,
  onCountChange,
}) {
  const toast = useToast();
  const [counts, setCounts] = useState({ total: 0, critical: 0, high: 0, medium: 0, info: 0 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countsError, setCountsError] = useState(false);
  const [ackingId, setAckingId] = useState(null);
  const [ackingAll, setAckingAll] = useState(false);
  const [severity, setSeverity] = useState('');
  const [priorityOnly, setPriorityOnly] = useState(true);

  const loadCounts = useCallback(async () => {
    try {
      const data = await adminSecurityAlertsApi.getCounts();
      const next = data || { total: 0, critical: 0, high: 0, medium: 0, info: 0 };
      setCounts(next);
      setCountsError(false);
      onCountChange?.(Number(next.total) || 0);
    } catch {
      setCountsError(true);
      setCounts({ total: 0, critical: 0, high: 0, medium: 0, info: 0 });
      onCountChange?.(0);
    }
  }, [onCountChange]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: 1, pageSize: 20, isAcknowledged: 'false' };
      if (severity) params.severity = severity;
      const data = await adminSecurityAlertsApi.list(params);
      let list = data?.items || [];
      if (priorityOnly && !severity) {
        list = [...list].sort((a, b) => {
          const rank = { critical: 0, high: 1, medium: 2, info: 3 };
          return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
        });
      }
      setItems(list);
    } catch (err) {
      setError(err?.message || 'Không tải được cảnh báo');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [severity, priorityOnly]);

  useEffect(() => {
    loadCounts();
    const t = setInterval(loadCounts, 60_000);
    return () => clearInterval(t);
  }, [loadCounts]);

  useEffect(() => {
    if (expanded) loadList();
  }, [expanded, loadList]);

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

  async function handleAckAll() {
    if (total <= 0 || ackingAll) return;
    const ok = window.confirm(
      `Đánh dấu đã xử lý tất cả ${total > 100 ? '99+' : total} cảnh báo chưa xử lý?`
    );
    if (!ok) return;
    setAckingAll(true);
    try {
      const result = await adminSecurityAlertsApi.ackAll();
      const n = result?.acknowledgedCount ?? 0;
      toast.success(n > 0 ? `Đã xử lý ${n} cảnh báo` : 'Không còn cảnh báo chưa xử lý');
      await Promise.all([loadList(), loadCounts()]);
    } catch (err) {
      toast.error(err?.message || 'Không thể xử lý hàng loạt');
    } finally {
      setAckingAll(false);
    }
  }

  function focusDevice(alert) {
    onFocusDevice?.(alert);
    onExpandedChange?.(false);
  }

  function openSessions(alert) {
    onOpenSessions?.(alert);
    onExpandedChange?.(false);
  }

  const total = Number(counts.total) || 0;
  const urgent = (Number(counts.critical) || 0) + (Number(counts.high) || 0);

  return (
    <section className={`sec-panel${expanded ? ' sec-panel--open' : ''}${total > 0 ? ' sec-panel--has-alerts' : ''}`}>
      <div className="sec-panel__banner">
        <div className="sec-panel__banner-main">
          <span className="sec-panel__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="sec-panel__banner-text">
            <strong>
              {countsError
                ? 'Không tải được số lượng cảnh báo'
                : total > 0
                ? `${total > 100 ? '99+' : total} cảnh báo chưa xử lý`
                : 'Không có cảnh báo chưa xử lý'}
            </strong>
            <span>
              {countsError
                ? 'Vui lòng bấm Làm mới hoặc kiểm tra kết nối API.'
                : urgent > 0
                ? `${urgent} mức Critical/High — kiểm tra rồi xử lý trên danh sách thiết bị bên dưới`
                : 'Cảnh báo chỉ là tín hiệu; thao tác đăng xuất nằm ở bảng thiết bị'}
            </span>
          </div>
        </div>

        <div className="sec-panel__chips" aria-label="Thống kê mức độ">
          <span className="sec-panel__chip sec-panel__chip--critical">Critical {counts.critical || 0}</span>
          <span className="sec-panel__chip sec-panel__chip--high">High {counts.high || 0}</span>
          <span className="sec-panel__chip sec-panel__chip--medium">Medium {counts.medium || 0}</span>
          <span className="sec-panel__chip sec-panel__chip--info">Info {counts.info || 0}</span>
        </div>

        <button
          type="button"
          className="btn btn--secondary btn--sm sec-panel__toggle"
          onClick={() => onExpandedChange?.(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Thu gọn' : 'Xem cảnh báo'}
        </button>
      </div>

      {expanded && (
        <div className="sec-panel__body">
          <div className="sec-panel__toolbar">
            <div className="sec-panel__filters">
              <label className="sec-panel__priority">
                <input
                  type="checkbox"
                  checked={priorityOnly}
                  onChange={(e) => setPriorityOnly(e.target.checked)}
                />
                Ưu tiên Critical/High
              </label>
              <select
                className="form-select sec-panel__select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="">Mọi mức độ</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="info">Info</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => { loadList(); loadCounts(); }}
            >
              Làm mới
            </button>
            {total > 0 && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={ackingAll}
                onClick={handleAckAll}
              >
                {ackingAll ? 'Đang xử lý...' : 'Đánh dấu tất cả đã xem'}
              </button>
            )}
          </div>

          {loading && <div className="sec-panel__loading">Đang tải cảnh báo...</div>}
          {error && !loading && <div className="sec-panel__error">{error}</div>}

          {!loading && !error && items.length === 0 && (
            <div className="sec-panel__empty">Không có cảnh báo phù hợp bộ lọc</div>
          )}

          {!loading && !error && items.length > 0 && (
            <ul className="sec-panel__list">
              {items.map((alert) => (
                <li key={alert.id} className="sec-panel__item">
                  <div className="sec-panel__item-top">
                    <span className={`sec-sev sec-sev--${alert.severity || 'info'}`}>
                      {SEVERITY_LABEL[alert.severity] || alert.severity || '—'}
                    </span>
                    <span className="sec-panel__time">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  <div className="sec-panel__item-title">{alert.title}</div>
                  <div className="sec-panel__item-msg">{alert.message}</div>
                  <div className="sec-panel__item-meta">
                    <span>{RULE_LABEL[alert.ruleKey] || alert.ruleKey || '—'}</span>
                    {alert.userId && (
                      <span>
                        · {alert.displayName || alert.userName || `#${alert.userId}`}
                      </span>
                    )}
                  </div>
                  <div className="sec-panel__item-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={ackingId === alert.id}
                      onClick={() => handleAck(alert.id)}
                    >
                      {ackingId === alert.id ? '...' : 'Đã xem'}
                    </button>
                    {canFocusDevice(alert) && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => focusDevice(alert)}
                        title={alert.userId ? 'Xem toàn bộ thiết bị của tài khoản này' : 'Xem thiết bị theo IP cảnh báo'}
                      >
                        {alert.userId ? 'Thiết bị tài khoản' : 'Xem theo IP'}
                      </button>
                    )}
                    {canOpenSessions(alert) && onOpenSessions && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => openSessions(alert)}
                        title={alert.userId ? 'Xem toàn bộ lịch sử đăng nhập của tài khoản' : 'Xem lịch sử đăng nhập thất bại theo IP'}
                      >
                        {alert.userId ? 'Lịch sử tài khoản' : 'Lịch sử theo IP'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="sec-panel__hint">
            <strong>Thiết bị tài khoản</strong> / <strong>Lịch sử tài khoản</strong> mở đúng dữ liệu
            của user trong cảnh báo. Cảnh báo theo IP thì lọc theo IP. Muốn force logout — dùng bảng
            thiết bị bên dưới.
          </p>
        </div>
      )}
    </section>
  );
}
