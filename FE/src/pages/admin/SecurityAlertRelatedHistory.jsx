import { useEffect, useState } from 'react';
import { adminSecurityAlertsApi } from '../../services/adminApi';
import './SecurityAlertRelatedHistory.css';

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
      second: '2-digit',
    });
  } catch {
    return String(value);
  }
}

/**
 * Lịch sử các lần cảnh báo cùng nhóm — chỉ hiện khi ≥ minCount (mặc định 2).
 */
export default function SecurityAlertRelatedHistory({ alert, onClear, minCount = 2 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!alert?.ruleKey) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await adminSecurityAlertsApi.related({
          ruleKey: alert.ruleKey,
          userId: alert.userId ?? '',
          pageSize: 50,
        });
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Không tải được lịch sử cảnh báo');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alert]);

  if (!alert) return null;
  // Ẩn khi chỉ 1 lần (tránh thừa) — vẫn hiện khi đang tải / lỗi
  if (!loading && !error && items.length < minCount) return null;

  return (
    <section className="sec-related-hist" aria-label="Lịch sử cảnh báo cùng loại">
      <div className="sec-related-hist__head">
        <div>
          <h2 className="sec-related-hist__title">Các lần cảnh báo cùng loại</h2>
          <p className="sec-related-hist__sub">
            {alert.title || 'Cảnh báo'}
            {alert.displayName || alert.userName ? ` · ${alert.displayName || alert.userName}` : ''}
            {!loading && !error ? ` · ${items.length} lần` : ''}
          </p>
        </div>
        {typeof onClear === 'function' && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
            Ẩn lịch sử cảnh báo
          </button>
        )}
      </div>

      {loading && <div className="sec-related-hist__state">Đang tải...</div>}
      {error && !loading && (
        <div className="sec-related-hist__state sec-related-hist__state--error">{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="sec-related-hist__state">Không có bản ghi trùng nhóm.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="sec-related-hist__table-wrap">
          <table className="sec-related-hist__table">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Mức</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const isCurrent = Number(row.id) === Number(alert.id);
                return (
                  <tr
                    key={row.id}
                    className={isCurrent ? 'sec-related-hist__row--current' : undefined}
                  >
                    <td className="sec-related-hist__time">{formatDateTime(row.createdAt)}</td>
                    <td>
                      <span
                        className={`sec-related-hist__sev sec-related-hist__sev--${row.severity || 'info'}`}
                      >
                        {SEVERITY_LABEL[row.severity] || row.severity || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="sec-related-hist__msg-title">{row.title || '—'}</div>
                      <div className="sec-related-hist__msg">{row.message || '—'}</div>
                    </td>
                    <td>
                      {isCurrent && (
                        <span className="sec-related-hist__tag sec-related-hist__tag--current">
                          Đang xem
                        </span>
                      )}
                      {row.isAcknowledged ? (
                        <span className="sec-related-hist__tag">Đã xem</span>
                      ) : (
                        <span className="sec-related-hist__tag sec-related-hist__tag--open">
                          Chưa xử lý
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="sec-related-hist__hint">
        Đối chiếu với bảng phiên phía trên. Muốn đăng xuất thiết bị: dùng nút «Xử lý trên tab Thiết
        bị» hoặc Chi tiết phiên → Buộc đăng xuất.
      </p>
    </section>
  );
}
