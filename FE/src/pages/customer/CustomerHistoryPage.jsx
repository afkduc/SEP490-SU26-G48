import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils';
import { listRepairSettlementsApi, getRepairSettlementApi } from '../../services/repairSettlementApi';
import { listCustomersApi, getCustomerApi, updateCustomerApi } from '../../services/customerApi';
import { getVehicleOwnerHistoryApi, transferVehicleOwnerApi } from '../../services/vehicleApi';
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

// ─── Form chuyển nhượng xe cho khách hàng khác (tìm khách theo tên/SĐT) ──
function TransferOwnerForm({ vehicleId, currentOwnerId, onDone, onCancel }) {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setSuggestions([]); return undefined; }
    const timer = setTimeout(() => {
      listCustomersApi({ search: term, limit: 5 })
        .then((result) => setSuggestions((result.items || []).filter((c) => String(c.id) !== String(currentOwnerId))))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, currentOwnerId]);

  const submit = async () => {
    if (!selected) { setError('Vui lòng chọn khách hàng nhận chuyển nhượng'); return; }
    setSaving(true);
    setError('');
    try {
      await transferVehicleOwnerApi(vehicleId, { newCustomerId: selected.id, transferDate, notes });
      onDone();
    } catch (err) {
      setError(err.message || 'Chuyển nhượng thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ border: '1px solid var(--primary-light)', background: 'var(--primary-very-light)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--primary-dark)' }}>🔄 Chuyển nhượng xe cho khách hàng khác</div>
      {error && (
        <div style={{ background: '#FFEBEE', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12, color: '#C62828' }}>⚠️ {error}</div>
      )}

      {!selected ? (
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            className="form-input"
            placeholder="Tìm khách hàng theo tên hoặc số điện thoại…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: 'var(--shadow-lg)', maxHeight: 220, overflowY: 'auto' }}>
              {suggestions.map((c) => (
                <div
                  key={c.id}
                  onMouseDown={() => { setSelected(c); setSuggestions([]); setSearch(''); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--gray-100)' }}
                >
                  <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{c.phone}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <b>Khách hàng mới:</b> {selected.fullName} ({selected.phone})
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Đổi</button>
        </div>
      )}

      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label">Ngày chuyển nhượng</label>
          <input className="form-input" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Ghi chú</label>
          <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VD: bán lại xe cũ…" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Hủy</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !selected}>
          {saving ? 'Đang lưu…' : 'Xác nhận chuyển nhượng'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal xem lịch sử dịch vụ của 1 chiếc xe (mở từ chi tiết khách hàng) ──
// Xe co the doi chu (ban lai) nen: lich su dich vu luon gan voi vehicle_id
// (hien thi du, khong phu thuoc ai dang so huu), kem cot "Khach hang" vi moi
// phieu co the thuoc ve chu cu hoac chu moi khac nhau; rieng "lich su chu xe"
// lay tu bang vehicle_owners de biet chinh xac giai doan ai so huu.
function VehicleHistoryModal({ vehicle, onClose, onTransferred }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewId, setViewId] = useState(null);

  const [owners, setOwners] = useState([]);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [showTransferForm, setShowTransferForm] = useState(false);

  const loadOwners = () => {
    setLoadingOwners(true);
    getVehicleOwnerHistoryApi(vehicle.id)
      .then((result) => setOwners(result || []))
      .catch(() => setOwners([]))
      .finally(() => setLoadingOwners(false));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listRepairSettlementsApi({ vehicleId: vehicle.id, limit: 100 })
      .then((result) => { if (alive) setHistory(result.items || []); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được lịch sử xe'); })
      .finally(() => { if (alive) setLoading(false); });
    loadOwners();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const currentOwner = owners.find((o) => !o.endDate);

  const handleTransferDone = () => {
    setShowTransferForm(false);
    loadOwners();
    onTransferred?.();
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">🚗 Lịch sử xe – {vehicle.licensePlate}</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="form-section-title">Thông tin xe</div>
            <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: 'var(--primary-dark)', marginBottom: 4 }}>{vehicle.licensePlate}</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{vehicle.vehicleModel || '—'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12, color: 'var(--gray-600)' }}>
                <div>Số khung: <b>{vehicle.frameNumber || '—'}</b></div>
                <div>Số máy: <b>{vehicle.engineNumber || '—'}</b></div>
                <div>Km hiện tại: <b>{(vehicle.currentKm || 0).toLocaleString('vi-VN')} km</b></div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-section-title" style={{ marginBottom: 0 }}>
                Lịch sử chủ xe <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--gray-500)' }}>({owners.length} chủ)</span>
              </div>
              {!showTransferForm && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowTransferForm(true)}>🔄 Đổi chủ xe</button>
              )}
            </div>

            {showTransferForm && (
              <TransferOwnerForm
                vehicleId={vehicle.id}
                currentOwnerId={currentOwner?.customerId}
                onDone={handleTransferDone}
                onCancel={() => setShowTransferForm(false)}
              />
            )}

            <div style={{ marginBottom: 16, marginTop: 10 }}>
              {loadingOwners && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Đang tải…</p>}
              {!loadingOwners && owners.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
                    border: '1px solid var(--gray-200)', borderRadius: 8, marginBottom: 6,
                    background: !o.endDate ? 'var(--primary-very-light)' : '#fff',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{o.customerName}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{o.customerPhone}</div>
                    {o.notes && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{o.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--gray-500)' }}>
                    <div>{formatDate(o.startDate) || 'Không rõ ngày'} → {o.endDate ? formatDate(o.endDate) : 'hiện tại'}</div>
                    {!o.endDate && (
                      <span className="badge badge-active" style={{ marginTop: 4, display: 'inline-block' }}>Chủ hiện tại</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="form-section-title">Lịch sử bảo dưỡng &amp; sửa chữa</div>
            {loadError && <p style={{ color: '#C62828' }}>⚠️ {loadError}</p>}
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Số phiếu</th><th>Ngày</th><th>Khách hàng</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6}><div className="empty-state"><p>Đang tải…</p></div></td></tr>
                  )}
                  {!loading && history.length === 0 && (
                    <tr><td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <h3>Chưa có lịch sử</h3>
                      </div>
                    </td></tr>
                  )}
                  {history.map((h) => {
                    const st = STATUS_LABELS[h.status] || { label: h.status, badge: 'badge-inactive' };
                    return (
                      <tr key={h.id}>
                        <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{h.code}</span></td>
                        <td style={{ fontSize: 12 }}>{h.date}</td>
                        <td style={{ fontSize: 12 }}>{h.customer?.fullName || '—'}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(h.total)}</td>
                        <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                        <td><button className="btn btn-secondary btn-sm btn-icon" title="Xem chi tiết" onClick={() => setViewId(h.id)}>👁️</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
      {viewId && <SettlementDetailModal settlementId={viewId} onClose={() => setViewId(null)} />}
    </>
  );
}

// ─── Modal chi tiết khách hàng: tab Thông tin (xem/sửa) + tab Lịch sử ──
function CustomerDetailModal({ customerId, onClose, onUpdated }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [vehicleView, setVehicleView] = useState(null);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewSettlementId, setViewSettlementId] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyVehicleId, setHistoryVehicleId] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const HISTORY_PAGE_SIZE = 5;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCustomerApi(customerId)
      .then((result) => { if (alive) setCustomer(result); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được thông tin khách hàng'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customerId]);

  // Sau khi doi chu xe (co the xe da chuyen sang khach khac), load lai thong
  // tin khach hang nay (danh sach xe co the thay doi) + bao cho CustomerList
  // reload de cap nhat luon so xe/lich su o man danh sach.
  const reloadAfterTransfer = () => {
    getCustomerApi(customerId)
      .then((result) => setCustomer(result))
      .catch(() => {});
    onUpdated?.();
  };

  useEffect(() => {
    if (tab !== 'history') return undefined;
    let alive = true;
    setLoadingHistory(true);
    listRepairSettlementsApi({
      customerId,
      vehicleId: historyVehicleId || undefined,
      status: historyStatus || undefined,
      fromDate: historyFromDate || undefined,
      toDate: historyToDate || undefined,
      page: historyPage,
      limit: HISTORY_PAGE_SIZE,
    })
      .then((result) => {
        if (!alive) return;
        setHistory(result.items || []);
        setHistoryTotal(result.total || 0);
      })
      .catch(() => { if (alive) { setHistory([]); setHistoryTotal(0); } })
      .finally(() => { if (alive) setLoadingHistory(false); });
    return () => { alive = false; };
  }, [tab, customerId, historyVehicleId, historyStatus, historyFromDate, historyToDate, historyPage]);

  const setHistoryFilterAndResetPage = (setter) => (value) => {
    setter(value);
    setHistoryPage(1);
  };
  const clearHistoryFilters = () => {
    setHistoryVehicleId('');
    setHistoryStatus('');
    setHistoryFromDate('');
    setHistoryToDate('');
    setHistoryPage(1);
  };
  const hasHistoryFilters = Boolean(historyVehicleId || historyStatus || historyFromDate || historyToDate);
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));

  const startEdit = () => { setForm({ ...customer }); setSaveError(''); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setForm(null); setSaveError(''); };
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const saveEdit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateCustomerApi(customerId, {
        fullName: form.fullName,
        phone: form.phone,
        cccd: form.cccd,
        dateOfBirth: form.dateOfBirth,
        email: form.email,
        address: form.address,
      });
      setCustomer(updated);
      setEditing(false);
      setForm(null);
      onUpdated?.();
    } catch (err) {
      setSaveError(err.message || 'Không lưu được thay đổi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">👤 {customer?.fullName || 'Khách hàng'}</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid var(--gray-200)' }}>
            {[
              { key: 'info', label: '📋 Thông tin', count: null },
              { key: 'history', label: '🛠️ Lịch sử dịch vụ', count: customer?.historyCount ?? null },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setEditing(false); }}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none',
                  borderBottom: tab === t.key ? '3px solid var(--primary)' : '3px solid transparent',
                  color: tab === t.key ? 'var(--primary-dark)' : 'var(--gray-500)',
                }}
              >
                {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          <div className="modal-body">
            {loading && <p>Đang tải…</p>}
            {loadError && <p style={{ color: '#C62828' }}>⚠️ {loadError}</p>}

            {customer && tab === 'info' && !editing && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    ['Họ và tên', customer.fullName],
                    ['Số điện thoại', customer.phone],
                    ['CCCD', customer.cccd || '—'],
                    ['Ngày sinh', formatDate(customer.dateOfBirth) || '—'],
                    ['Email', customer.email || '—'],
                    ['Địa chỉ', customer.address || '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <div className="detail-label">{l}</div>
                      <div className="detail-value">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="form-section-title">🚗 Xe của khách hàng ({customer.vehicles.length})</div>
                {customer.vehicles.length === 0 && (
                  <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Khách hàng chưa có xe nào.</p>
                )}
                {customer.vehicles.map((v) => (
                  <div key={v.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-dark)' }}>{v.licensePlate}</span>
                      <button className="btn btn-info btn-sm" onClick={() => setVehicleView(v)}>🔍 Lịch sử xe</button>
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{v.vehicleModel || '—'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12, color: 'var(--gray-600)' }}>
                      <div>Số khung: <b>{v.frameNumber || '—'}</b></div>
                      <div>Số máy: <b>{v.engineNumber || '—'}</b></div>
                      <div>Km hiện tại: <b>{(v.currentKm || 0).toLocaleString('vi-VN')} km</b></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {customer && tab === 'info' && editing && form && (
              <div>
                {saveError && (
                  <div style={{ background: '#FFEBEE', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#C62828' }}>
                    ⚠️ {saveError}
                  </div>
                )}
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label required">Họ và tên</label>
                    <input className="form-input" value={form.fullName || ''} onChange={(e) => setF('fullName', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Số điện thoại</label>
                    <input className="form-input" value={form.phone || ''} onChange={(e) => setF('phone', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CCCD</label>
                    <input className="form-input" value={form.cccd || ''} onChange={(e) => setF('cccd', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngày sinh</label>
                    <input className="form-input" type="date" value={form.dateOfBirth ? String(form.dateOfBirth).slice(0, 10) : ''} onChange={(e) => setF('dateOfBirth', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={form.email || ''} onChange={(e) => setF('email', e.target.value)} placeholder="example@email.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa chỉ</label>
                    <input className="form-input" value={form.address || ''} onChange={(e) => setF('address', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
                    <label className="form-label">Xe</label>
                    <select
                      className="form-select"
                      value={historyVehicleId}
                      onChange={(e) => setHistoryFilterAndResetPage(setHistoryVehicleId)(e.target.value)}
                    >
                      <option value="">Tất cả xe</option>
                      {(customer?.vehicles || []).map((v) => (
                        <option key={v.id} value={v.id}>{v.licensePlate}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                    <label className="form-label">Trạng thái</label>
                    <select
                      className="form-select"
                      value={historyStatus}
                      onChange={(e) => setHistoryFilterAndResetPage(setHistoryStatus)(e.target.value)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      {Object.entries(STATUS_LABELS).map(([key, v]) => (
                        <option key={key} value={key}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Từ ngày</label>
                    <input
                      className="form-input"
                      type="date"
                      value={historyFromDate}
                      onChange={(e) => setHistoryFilterAndResetPage(setHistoryFromDate)(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Đến ngày</label>
                    <input
                      className="form-input"
                      type="date"
                      value={historyToDate}
                      onChange={(e) => setHistoryFilterAndResetPage(setHistoryToDate)(e.target.value)}
                    />
                  </div>
                  {hasHistoryFilters && (
                    <button className="btn btn-secondary btn-sm" onClick={clearHistoryFilters}>Xóa lọc</button>
                  )}
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Số phiếu</th><th>Ngày</th><th>Xe</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr></thead>
                    <tbody>
                      {loadingHistory && (
                        <tr><td colSpan={6}><div className="empty-state"><p>Đang tải…</p></div></td></tr>
                      )}
                      {!loadingHistory && history.length === 0 && (
                        <tr><td colSpan={6}>
                          <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <h3>Chưa có lịch sử dịch vụ</h3>
                            {hasHistoryFilters && <p>Không có phiếu nào khớp bộ lọc đang chọn.</p>}
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
                            <td><button className="btn btn-secondary btn-sm btn-icon" title="Xem chi tiết" onClick={() => setViewSettlementId(h.id)}>👁️</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {historyTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: 'var(--gray-500)' }}>
                    <div>Tổng {historyTotal} phiếu</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage((p) => p - 1)}
                      >
                        ‹ Trước
                      </button>
                      <span>Trang {historyPage}/{historyTotalPages}</span>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={historyPage >= historyTotalPages}
                        onClick={() => setHistoryPage((p) => p + 1)}
                      >
                        Sau ›
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            {tab === 'info' && !editing && (
              <button className="btn btn-warning" onClick={startEdit}>✏️ Chỉnh sửa thông tin</button>
            )}
            {tab === 'info' && editing && (
              <>
                <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>Hủy</button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Đang lưu…' : '💾 Lưu thay đổi'}</button>
              </>
            )}
            {!editing && <button className="btn btn-secondary" onClick={onClose}>Đóng</button>}
          </div>
        </div>
      </div>

      {vehicleView && (
        <VehicleHistoryModal
          vehicle={vehicleView}
          onClose={() => setVehicleView(null)}
          onTransferred={reloadAfterTransfer}
        />
      )}
      {viewSettlementId && <SettlementDetailModal settlementId={viewSettlementId} onClose={() => setViewSettlementId(null)} />}
    </>
  );
}

// ─── Danh sách khách hàng (dữ liệu thật, tìm theo tên/SĐT/biển số) ────
function CustomerList() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalCustomers: 0, totalServiceHistory: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = () => {
    setLoading(true);
    setLoadError('');
    listCustomersApi({ search: debouncedSearch, limit: 100 })
      .then((result) => {
        setItems(result.items || []);
        setSummary(result.summary || { totalCustomers: 0, totalServiceHistory: 0 });
      })
      .catch((err) => setLoadError(err.message || 'Không tải được danh sách khách hàng'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [debouncedSearch]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Khách hàng</h1>
          <div className="breadcrumb">Trang chủ / Khách hàng / Danh sách khách hàng</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20, maxWidth: 560 }}>
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: 24 }}>👤</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)', margin: '4px 0 2px' }}>{summary.totalCustomers}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Tổng khách hàng</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: 24 }}>🛠️</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-dark)', margin: '4px 0 2px' }}>{summary.totalServiceHistory}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Tổng lượt dịch vụ</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon">🔍</span>
          <input placeholder="Tên, số điện thoại, biển số xe…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)' }}>{items.length} khách hàng</div>
      </div>

      {loadError && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#C62828' }}>
          ⚠️ {loadError}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Họ và tên</th><th>Số điện thoại</th><th>Địa chỉ</th><th>Xe</th><th style={{ textAlign: 'center' }}>Lịch sử DV</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6}><div className="empty-state"><p>Đang tải danh sách khách hàng…</p></div></td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Không tìm thấy khách hàng</h3>
                </div>
              </td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 700 }}>{c.fullName}</td>
                <td style={{ fontSize: 13 }}>{c.phone}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-600)', maxWidth: 220 }}>{c.address || '—'}</td>
                <td>
                  {c.vehicles.length === 0 && <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>—</span>}
                  {c.vehicles.map((v) => (
                    <div key={v.id} style={{ fontSize: 12 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{v.licensePlate}</span>
                      <span style={{ color: 'var(--gray-500)', marginLeft: 4 }}>{v.vehicleModel}</span>
                    </div>
                  ))}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {c.historyCount > 0
                    ? <span className="badge badge-active">{c.historyCount} lần</span>
                    : <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>—</span>}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-info btn-sm" onClick={() => setSelectedId(c.id)}>📋 Xem chi tiết</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <CustomerDetailModal customerId={selectedId} onClose={() => setSelectedId(null)} onUpdated={load} />
      )}
    </div>
  );
}

export default function CustomerHistoryPage() {
  return <CustomerList />;
}
