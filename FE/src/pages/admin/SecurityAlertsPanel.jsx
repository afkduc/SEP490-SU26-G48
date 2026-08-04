import { useCallback, useEffect, useState } from 'react';
import { adminSecurityAlertsApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import { parseAlertMeta } from './securityAlertFocus';
import { emitSecurityAlertsCount } from '../../utils/securityAlertEvents';
import './SecurityAlertsPanel.css';

const RULE_LABEL = {
  failed_login_burst: 'Đăng nhập sai liên tiếp',
  new_admin_role: 'Gán quyền Admin',
  inactive_admin: 'Admin không hoạt động',
  new_device_ip: 'IP/thiết bị mới',
  session_takeover: 'Đăng nhập trên thiết bị khác',
};

const SEVERITY_LABEL = {
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  info: 'Thông tin',
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

function canOpenSessions(alert) {
  if (!alert) return false;
  if (alert.userId) return true;
  const meta = parseAlertMeta(alert.metadata);
  return Boolean(meta.ipAddress || meta.ip);
}

/**
 * Panel phụ trên tab Thiết bị — tín hiệu cảnh báo, không phải chỗ force logout.
 */
export default function SecurityAlertsPanel({
  expanded,
  onExpandedChange,
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
  const [page, setPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const PAGE_SIZE = 8;

  const loadCounts = useCallback(async () => {
    try {
      const data = await adminSecurityAlertsApi.getCounts();
      const next = data || { total: 0, critical: 0, high: 0, medium: 0, info: 0 };
      setCounts(next);
      setCountsError(false);
      onCountChange?.(next);
      emitSecurityAlertsCount(next);
    } catch {
      setCountsError(true);
      const empty = { total: 0, critical: 0, high: 0, medium: 0, info: 0 };
      setCounts(empty);
      onCountChange?.(empty);
      emitSecurityAlertsCount(0);
    }
  }, [onCountChange]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = { isAcknowledged: 'false', collapsed: true };

      if (severity) {
        const data = await adminSecurityAlertsApi.list({
          ...base,
          severity,
          page,
          pageSize: PAGE_SIZE,
        });
        setItems(Array.isArray(data?.items) ? data.items : []);
        setListTotal(Number(data?.total) || 0);
        return;
      }

      if (priorityOnly) {
        const [crit, high] = await Promise.all([
          adminSecurityAlertsApi.list({
            ...base,
            severity: 'critical',
            page: 1,
            pageSize: 100,
          }),
          adminSecurityAlertsApi.list({
            ...base,
            severity: 'high',
            page: 1,
            pageSize: 100,
          }),
        ]);
        const merged = [...(crit?.items || []), ...(high?.items || [])].sort((a, b) => {
          const rank = { critical: 0, high: 1 };
          const ra = rank[a.severity] ?? 9;
          const rb = rank[b.severity] ?? 9;
          if (ra !== rb) return ra - rb;
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        const start = (page - 1) * PAGE_SIZE;
        setListTotal(merged.length);
        setItems(merged.slice(start, start + PAGE_SIZE));
        return;
      }

      const data = await adminSecurityAlertsApi.list({
        ...base,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setListTotal(Number(data?.total) || 0);
    } catch (err) {
      setError(err?.message || 'Không tải được cảnh báo');
      setItems([]);
      setListTotal(0);
    } finally {
      setLoading(false);
    }
  }, [severity, priorityOnly, page]);

  useEffect(() => {
    loadCounts();
    const t = setInterval(loadCounts, 60_000);
    return () => clearInterval(t);
  }, [loadCounts]);

  useEffect(() => {
    setPage(1);
  }, [severity, priorityOnly]);

  useEffect(() => {
    if (expanded) loadList();
  }, [expanded, loadList]);

  async function handleAck(id) {
    setAckingId(id);
    try {
      await adminSecurityAlertsApi.ack(id);
      toast.success('Đã đánh dấu xử lý cảnh báo');
      const item = items.find((a) => a.id === id);
      const next = { ...counts };
      next.total = Math.max(0, (Number(counts.total) || 0) - 1);
      if (item?.severity && next[item.severity] != null) {
        next[item.severity] = Math.max(0, (Number(next[item.severity]) || 0) - 1);
      }
      setCounts(next);
      onCountChange?.(next);
      emitSecurityAlertsCount(next);
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
      const empty = { total: 0, critical: 0, high: 0, medium: 0, info: 0 };
      setCounts(empty);
      onCountChange?.(empty);
      emitSecurityAlertsCount(empty);
      await Promise.all([loadList(), loadCounts()]);
    } catch (err) {
      toast.error(err?.message || 'Không thể xử lý hàng loạt');
    } finally {
      setAckingAll(false);
    }
  }

  function openSessions(alert) {
    // Không thu gọn / đổi ?alerts= — AdminLayout remount theo location.search
    // sẽ xóa state popup ngay sau khi mở.
    onOpenSessions?.(alert);
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
                ? `${urgent} mức Nghiêm trọng/Cao — bấm Xem phiên để đối chiếu, xử lý trên bảng thiết bị`
                : 'Mức Trung bình/Thông tin chỉ theo dõi; thao tác đăng xuất nằm ở bảng thiết bị'}
            </span>
          </div>
        </div>

        <div className="sec-panel__chips" aria-label="Thống kê mức độ">
          <span className="sec-panel__chip sec-panel__chip--critical">Nghiêm trọng {counts.critical || 0}</span>
          <span className="sec-panel__chip sec-panel__chip--high">Cao {counts.high || 0}</span>
          <span className="sec-panel__chip sec-panel__chip--medium">Trung bình {counts.medium || 0}</span>
          <span className="sec-panel__chip sec-panel__chip--info">Thông tin {counts.info || 0}</span>
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
                Ưu tiên Nghiêm trọng/Cao
              </label>
              <div className="sec-panel__filter-row">
                <select
                  className="form-select sec-panel__select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  aria-label="Lọc mức độ cảnh báo"
                >
                  <option value="">Mọi mức độ</option>
                  <option value="critical">Nghiêm trọng</option>
                  <option value="high">Cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="info">Thông tin</option>
                </select>
                <button
                  type="button"
                  className="sec-panel__refresh"
                  onClick={() => { loadList(); loadCounts(); }}
                  title="Làm mới"
                  aria-label="Làm mới danh sách cảnh báo"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
              </div>
            </div>
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
                    {Number(alert.duplicateCount) > 1 && (
                      <span className="sec-panel__dup">· {alert.duplicateCount} lần (chỉ hiện mới nhất)</span>
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
                    {canOpenSessions(alert) && onOpenSessions && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => openSessions(alert)}
                        title="Mở tab Lịch sử, lọc phiên liên quan"
                      >
                        Xem phiên
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && !error && listTotal > PAGE_SIZE && (
            <div className="sec-panel__pager">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Trước
              </button>
              <span>
                Trang {page}/{Math.max(1, Math.ceil(listTotal / PAGE_SIZE))}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={page >= Math.ceil(listTotal / PAGE_SIZE)}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau →
              </button>
            </div>
          )}

          <p className="sec-panel__hint">
            <strong>Đã xem</strong> đánh dấu xử lý.
            <strong> Xem phiên</strong> mở tab Lịch sử (lọc theo cảnh báo, highlight phiên mới nhất).
            Đăng xuất thiết bị ở bảng bên dưới.
          </p>
        </div>
      )}
    </section>
  );
}
