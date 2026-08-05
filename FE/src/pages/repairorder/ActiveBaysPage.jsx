// CVDV - xem khoang xe nao cua to truong nao dang hoat dong, dang lam xe gi
// (neu co) - realtime qua cung kenh SSE voi kiosk to truong (TeamLeaderKiosk.jsx).
import { useCallback, useEffect, useState } from 'react';
import { listBranchBaysApi } from '../../services/vehicleBayApi';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import './ActiveBaysPage.css';

const REFRESH_EVENT_TYPES = new Set(['bay-occupied', 'bay-released', 'claimed', 'order-completed']);

export default function ActiveBaysPage() {
  const [bays, setBays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    return listBranchBaysApi()
      .then((data) => setBays(data || []))
      .catch((err) => setError(err.message || 'Không tải được danh sách khoang xe'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEvent = useCallback((event) => {
    if (REFRESH_EVENT_TYPES.has(event.type)) load();
  }, [load]);
  useRepairOrderEventsSSE(handleEvent, true);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Khoang xe đang hoạt động</h1>
          <div className="breadcrumb">Trang chủ / Khoang xe đang hoạt động</div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#e4e4e7', border: '1px solid #a1a1aa', color: '#27272a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="empty-state"><p>Đang tải…</p></div>
      )}

      {!loading && bays.length === 0 && !error && (
        <div className="empty-state">
          <h3>Chi nhánh chưa có khoang xe nào</h3>
          <p>Liên hệ Quản lý chi nhánh để cấu hình khoang xe cho từng tổ trưởng.</p>
        </div>
      )}

      {!loading && bays.length > 0 && (
        <div className="active-bays-grid">
          {bays.map((b) => {
            const active = Boolean(b.occupiedByDeviceId);
            return (
              <div key={b.id} className={`active-bays-card ${active ? 'active-bays-card--active' : ''}`}>
                <div className="active-bays-card__header">
                  <span className="active-bays-card__number">Khoang {b.bayNumber}</span>
                  <span className={`badge ${active ? 'badge-inprogress' : 'badge-inactive'}`}>
                    {active ? 'Đang hoạt động' : 'Trống'}
                  </span>
                </div>
                <div className="active-bays-card__leader">Tổ trưởng: {b.teamLeaderName || '—'}</div>
                <div className={`active-bays-card__vehicle ${b.activeVehicle ? '' : 'active-bays-card__vehicle--empty'}`}>
                  {b.activeVehicle ? `${b.activeVehicle.licensePlate} · ${b.activeVehicle.vehicleModel}` : 'Chưa có xe đang làm'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
