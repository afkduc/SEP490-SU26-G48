import { useCallback, useEffect, useState } from 'react';
import { getMyDevices } from '../../services/profileApi';
import { formatDateSafe } from '../../utils/dateUtils';
import './MyDevicesPanel.css';

function formatDate(value) {
  return formatDateSafe(value, {
    timeZone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
  });
}

/**
 * Danh sách thiết bị đăng nhập của chính user (xem + làm mới).
 * Không còn đánh dấu tin cậy — đăng xuất thiết bị lạ do admin / logout all.
 */
export default function MyDevicesPanel({ embedded = false } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyDevices();
      setItems(data?.items || []);
    } catch (err) {
      setError(err?.message || 'Không tải được danh sách thiết bị');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`my-devices${embedded ? ' my-devices--embedded' : ''}`}>
      {!embedded && (
        <div className="my-devices__header">
          <h2>Thiết bị đăng nhập</h2>
          <p>Các máy đã đăng nhập tài khoản của bạn.</p>
        </div>
      )}

      <div className="my-devices__hint">
        Thiết bị được nhận diện theo trình duyệt, hệ điều hành và IP.
        Nếu thấy máy lạ, dùng <strong>Đăng xuất mọi thiết bị</strong> hoặc nhờ admin đăng xuất thiết bị đó.
      </div>

      {loading && <div className="my-devices__loading">Đang tải thiết bị...</div>}
      {error && !loading && <div className="my-devices__error">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="my-devices__empty">Chưa ghi nhận thiết bị nào</div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="my-devices__list">
          {items.map((d) => (
            <li key={d.id} className={`my-devices__item${d.isThisDevice ? ' is-this' : ''}`}>
              <div className="my-devices__item-main">
                <div className="my-devices__item-title">
                  {d.deviceName || 'Thiết bị'}
                  {d.isThisDevice && <span className="my-devices__pill my-devices__pill--this">Máy này</span>}
                  {d.isCurrent
                    ? <span className="my-devices__pill my-devices__pill--on">Đang online</span>
                    : <span className="my-devices__pill">Offline</span>}
                </div>
                <div className="my-devices__item-meta">
                  {d.browser} · {d.os} · IP {d.ipAddress || '—'}
                </div>
                <div className="my-devices__item-meta">
                  Đăng nhập gần nhất: {formatDate(d.lastLoginAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="my-devices__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
          Làm mới
        </button>
      </div>
    </div>
  );
}
