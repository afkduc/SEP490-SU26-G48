import { useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { formatCurrency } from '../../utils';
import { searchVehiclesApi } from '../../services/vehicleApi';
import { listRepairSettlementsApi, getRepairSettlementApi } from '../../services/repairSettlementApi';
import { STATUS_LABELS } from '../repairsettlement/mockData';

// ─── Modal xem chi tiết 1 phiếu quyết toán trong lịch sử ─────────────
function SettlementDetailModal({ settlementId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getRepairSettlementApi(settlementId)
      .then((result) => { if (alive) setDetail(result); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được chi tiết phiếu'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [settlementId]);

  const st = detail && (STATUS_LABELS[detail.status] || { label: detail.status, badge: 'badge-inactive' });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📋 Phiếu quyết toán {detail?.code || ''}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {st && <span className={`badge ${st.badge}`}>{st.label}</span>}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          {loading && <p>Đang tải…</p>}
          {loadError && <p style={{ color: '#C62828' }}>⚠️ {loadError}</p>}
          {detail && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div className="form-section-title">Khách hàng</div>
                  {[
                    ['Họ tên', detail.customer?.fullName],
                    ['Địa chỉ', detail.customer?.address],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <div className="detail-label" style={{ width: 120, fontSize: 11 }}>{l}</div>
                      <div className="detail-value" style={{ fontSize: 12 }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="form-section-title">Xe</div>
                  {[
                    ['Biển số', detail.vehicle?.licensePlate],
                    ['Loại xe', detail.vehicle?.vehicleModel],
                    ['Số Km', `${(detail.vehicle?.currentKm || 0).toLocaleString()} km`],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <div className="detail-label" style={{ width: 120, fontSize: 11 }}>{l}</div>
                      <div className="detail-value" style={{ fontSize: 12 }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-section-title">Yêu cầu khách hàng</div>
              <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 16 }}>
                {detail.customerRequest || '—'}
              </div>

              {detail.cancelReason && (
                <>
                  <div className="form-section-title">Lý do hủy</div>
                  <div style={{ background: '#FFEBEE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 16, color: '#C62828' }}>
                    {detail.cancelReason}
                  </div>
                </>
              )}

              <div className="form-section-title">Hạng mục công việc / phụ tùng</div>
              <div className="table-wrapper" style={{ marginBottom: 12 }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>#</th><th>Nội dung</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
                  </thead>
                  <tbody>
                    {(detail.items || []).map((item, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: 'center' }}>{i + 1}</td>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div className="summary-box" style={{ minWidth: 260 }}>
                  <div className="summary-row total"><span>Tổng cộng:</span><span>{formatCurrency(detail.total)}</span></div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ─── Lịch sử bảo dưỡng (theo khách hàng, tìm bằng tên/SĐT/biển số) ───
// 1 ô tìm kiếm duy nhất - gõ tên, số điện thoại hay biển số đều ra gợi ý
// (dùng chung API tra cứu khách hàng/xe). Chọn 1 gợi ý sẽ hiện toàn bộ lịch
// sử bảo dưỡng của KHÁCH HÀNG đó (tất cả xe họ có), kèm cột biển số để biết
// từng lần bảo dưỡng thuộc xe nào - không cần tách thành 2 màn hình riêng.
function MaintenanceHistory() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selected, setSelected] = useState(null); // { customerId, fullName, phone, address, licensePlate, vehicleModel }
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [viewId, setViewId] = useState(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setSuggestions([]); return undefined; }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const results = await searchVehiclesApi(term);
        if (seq === searchSeq.current) setSuggestions(results || []);
      } catch {
        if (seq === searchSeq.current) setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectRow = (row) => {
    setSelected({
      customerId: row.customerId, fullName: row.fullName, phone: row.phone, address: row.address,
      licensePlate: row.licensePlate, vehicleModel: row.vehicleModel,
    });
    setQuery(`${row.fullName} — ${row.licensePlate}`);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (!selected) { setHistory([]); return undefined; }
    let alive = true;
    setLoadingHistory(true);
    setLoadError('');
    listRepairSettlementsApi({ customerId: selected.customerId, limit: 100 })
      .then((result) => { if (alive) setHistory(result.items || []); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được lịch sử bảo dưỡng'); })
      .finally(() => { if (alive) setLoadingHistory(false); });
    return () => { alive = false; };
  }, [selected]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Lịch sử bảo dưỡng</h1>
          <div className="breadcrumb">Trang chủ / Khách hàng / Lịch sử bảo dưỡng</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-group" style={{ position: 'relative', maxWidth: 460 }}>
            <label className="form-label">Tìm theo tên khách hàng, số điện thoại hoặc biển số xe</label>
            <input
              className="form-input"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              placeholder="Nhập tên, số điện thoại hoặc biển số…"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', maxHeight: 320, overflowY: 'auto' }}>
                {suggestions.map((row) => (
                  <div key={`${row.customerId}-${row.vehicleId}`} onMouseDown={() => selectRow(row)}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--gray-100)' }}>
                    <div style={{ fontWeight: 600 }}>{row.fullName} <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>— {row.licensePlate} ({row.vehicleModel})</span></div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!selected && (
        <div style={{ background: 'var(--gray-100)', border: '1px solid var(--gray-300)', borderRadius: 8, padding: '14px 18px', fontSize: 13, color: 'var(--gray-700)' }}>
          Nhập tên khách hàng, số điện thoại hoặc biển số xe để xem lịch sử bảo dưỡng.
        </div>
      )}

      {selected && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <div><b>Khách hàng:</b> {selected.fullName}</div>
              <div><b>Điện thoại:</b> {selected.phone}</div>
              <div><b>Địa chỉ:</b> {selected.address || '—'}</div>
              <div><b>Xe vừa chọn:</b> {selected.licensePlate} ({selected.vehicleModel})</div>
            </div>
          </div>

          {loadError && (
            <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#C62828' }}>
              ⚠️ {loadError}
            </div>
          )}

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Số phiếu</th><th>Ngày</th><th>Xe</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr>
              </thead>
              <tbody>
                {loadingHistory && (
                  <tr><td colSpan={6}><div className="empty-state"><p>Đang tải lịch sử bảo dưỡng…</p></div></td></tr>
                )}
                {!loadingHistory && history.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>Chưa có lịch sử bảo dưỡng</h3>
                      <p>Khách hàng này chưa có phiếu quyết toán sửa chữa nào.</p>
                    </div>
                  </td></tr>
                )}
                {history.map((h) => {
                  const st = STATUS_LABELS[h.status] || { label: h.status, badge: 'badge-inactive' };
                  return (
                    <tr key={h.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{h.code}</span></td>
                      <td style={{ fontSize: 12 }}>{h.date}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{h.vehicle?.licensePlate}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{h.vehicle?.vehicleModel}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(h.total)}</td>
                      <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                      <td><button className="btn btn-secondary btn-sm btn-icon" title="Xem chi tiết" onClick={() => setViewId(h.id)}>👁️</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewId && <SettlementDetailModal settlementId={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

export default function CustomerHistoryPage() {
  return (
    <Routes>
      <Route index element={<div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Trang đang phát triển...</div>} />
      <Route path="history" element={<MaintenanceHistory />} />
    </Routes>
  );
}
