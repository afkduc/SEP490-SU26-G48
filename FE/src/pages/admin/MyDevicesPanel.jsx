import { useCallback, useEffect, useState } from 'react';
import { getMyDevices, setMyDeviceTrusted } from '../../services/profileApi';
import { useToast } from '../../components/common/ToastContext';
import { formatDateSafe } from '../../utils/dateUtils';
import './MyDevicesPanel.css';

function formatDate(value) {
  return formatDateSafe(value, {
    timeZone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
  });
}

/**
 * Danh sách thiết bị của chính user + nút đánh dấu tin cậy.
 * Dùng trong tab Tài khoản (admin) hoặc khối hồ sơ các role khác.
 */
export default function MyDevicesPanel({ embedded = false } = {}) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

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

  async function toggleTrusted(device) {
    if (!device?.id || busyId) return;
    const next = !device.isTrusted;
    setBusyId(device.id);
    try {
      const updated = await setMyDeviceTrusted(device.id, next);
      setItems((prev) =>
        prev.map((d) => (d.id === device.id
          ? { ...d, isTrusted: updated?.isTrusted ?? next, trustedAt: updated?.trustedAt || null }
          : d))
      );
      toast.success(next
        ? 'Đã đánh dấu thiết bị tin cậy — lần sau login máy này sẽ không báo “thiết bị lạ”'
        : 'Đã bỏ tin cậy thiết bị');
    } catch (err) {
      toast.error(err?.message || 'Không cập nhật được trạng thái tin cậy');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={`my-devices${embedded ? ' my-devices--embedded' : ''}`}>
      {!embedded && (
        <div className="my-devices__header">
          <h2>Thiết bị đăng nhập</h2>
          <p>Đánh dấu máy của bạn là tin cậy để phân biệt với thiết bị lạ.</p>
        </div>
      )}

      <div className="my-devices__hint">
        <strong>Máy tin cậy:</strong> cùng trình duyệt + hệ điều hành đã được bạn xác nhận —
        đổi WiFi/IP vẫn được nhận là máy quen. Thiết bị chưa tin cậy sẽ báo cảnh báo khi login mới.
      </div>

      {loading && <div className="my-devices__loading">Đang tải thiết bị...</div>}
      {error && !loading && <div className="my-devices__error">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="my-devices__empty">Chưa ghi nhận thiết bị nào</div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="my-devices__list">
          {items.map((d) => (
            <li key={d.id} className={`my-devices__item${d.isThisDevice ? ' is-this' : ''}${d.isTrusted ? ' is-trusted' : ''}`}>
              <div className="my-devices__item-main">
                <div className="my-devices__item-title">
                  {d.deviceName || 'Thiết bị'}
                  {d.isThisDevice && <span className="my-devices__pill my-devices__pill--this">Máy này</span>}
                  {d.isTrusted
                    ? <span className="my-devices__pill my-devices__pill--trusted">Tin cậy</span>
                    : <span className="my-devices__pill my-devices__pill--new">Chưa tin cậy</span>}
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
              <button
                type="button"
                className={`btn btn--sm ${d.isTrusted ? 'btn--ghost' : 'btn--primary'}`}
                disabled={busyId === d.id}
                onClick={() => toggleTrusted(d)}
              >
                {busyId === d.id
                  ? '...'
                  : d.isTrusted
                    ? 'Bỏ tin cậy'
                    : 'Đánh dấu tin cậy'}
              </button>
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
