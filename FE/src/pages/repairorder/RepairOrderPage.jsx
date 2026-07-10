import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { formatCurrency } from '../../utils';
import {
  listRepairOrdersApi,
  listQuotesApi,
  listTechniciansApi,
  createRepairOrderApi,
} from '../../services/repairOrderMockApi';
import {
  MOCK_BRANCH,
  PRIORITY_OPTIONS,
  REPAIR_ORDER_TYPE_LABELS,
  SKILL_LEVEL_LABELS,
} from '../../mocks/repairOrderMockData';

// ─── Danh sách lệnh sửa chữa ──────────────────────────────────────────
function RepairOrderList() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listRepairOrdersApi()
      .then((result) => { if (alive) setOrders(result.data || []); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được danh sách lệnh sửa chữa'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Lệnh sửa chữa</h1>
          <div className="breadcrumb">Trang chủ / Lệnh sửa chữa</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
            🏢 {user?.branchName || user?.branch || MOCK_BRANCH}
          </span>
          <Link to="/repair-orders/create" className="btn btn-primary">➕ Tạo lệnh sửa chữa</Link>
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
            <tr>
              <th>Số lệnh</th><th>Khách hàng</th><th>Xe</th>
              <th>Kỹ thuật viên phụ trách</th><th>Mức độ ưu tiên</th><th>Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6}>
                <div className="empty-state"><p>Đang tải danh sách lệnh sửa chữa…</p></div>
              </td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Chưa có lệnh sửa chữa nào</h3>
                  <p>Nhấn "Tạo lệnh sửa chữa" để phân công kỹ thuật viên cho một phiếu báo giá.</p>
                </div>
              </td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{o.code}</span></td>
                <td>{o.customer?.fullName}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.vehicle?.licensePlate}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{o.vehicle?.vehicleModel}</div>
                </td>
                <td style={{ fontSize: 12 }}>
                  {o.technicians?.length
                    ? o.technicians.map((t) => t.fullName).join(', ')
                    : <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Chưa phân công</span>}
                </td>
                <td>{PRIORITY_OPTIONS.find((p) => p.value === o.priority)?.label || '—'}</td>
                <td style={{ fontSize: 12 }}>{o.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tạo lệnh sửa chữa: phân công kỹ thuật viên ──────────────────────
function RepairOrderCreate() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState([]);
  const [priority, setPriority] = useState('normal');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([listQuotesApi(), listTechniciansApi()])
      .then(([quoteResult, technicianResult]) => {
        if (!alive) return;
        setQuotes(quoteResult.data || []);
        setTechnicians(technicianResult.data || []);
        setSelectedQuoteId((quoteResult.data || [])[0]?.id ?? null);
      })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được dữ liệu'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) || null,
    [quotes, selectedQuoteId],
  );

  const selectedTechnicians = useMemo(
    () => technicians.filter((t) => selectedTechnicianIds.includes(t.id)),
    [technicians, selectedTechnicianIds],
  );

  const toggleTechnician = (id) => {
    setSelectedTechnicianIds((prev) => (
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    ));
  };

  const canConfirm = Boolean(selectedQuote) && selectedTechnicianIds.length > 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setSaveError('');
    try {
      await createRepairOrderApi({
        quoteId: selectedQuote.id,
        priority,
        note,
        technicians: selectedTechnicians.map((t) => ({ id: t.id, fullName: t.fullName, specialty: t.specialty })),
      });
      navigate('/repair-orders');
    } catch (err) {
      setSaveError(err.message || 'Tạo lệnh sửa chữa thất bại');
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Đang tải dữ liệu…</div>;
  if (loadError) return <div className="page-loading">⚠️ {loadError}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Tạo lệnh sửa chữa</h1>
          <div className="breadcrumb">Trang chủ / Lệnh sửa chữa / Tạo lệnh sửa chữa</div>
        </div>
      </div>

      {selectedQuote && (
        <div style={{
          background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8,
          padding: '14px 18px', marginBottom: 16, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ fontSize: 13, color: '#2E7D32' }}>
            ✅ <b>Phiếu báo giá đã được chọn</b>
            <div style={{ fontSize: 12, color: 'var(--gray-700)', marginTop: 2 }}>
              {selectedQuote.customer?.fullName} — {selectedQuote.vehicle?.licensePlate} &nbsp;|&nbsp;
              Mã báo giá: <b>{selectedQuote.code}</b> &nbsp;|&nbsp; Tổng cộng: <b>{formatCurrency(selectedQuote.total)}</b>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowQuotePicker(true)}>Đổi phiếu báo giá</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <div className="form-section-title">Chi tiết dịch vụ cần thực hiện</div>
          <div className="table-wrapper" style={{ marginBottom: 20 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dịch vụ / Vật tư</th><th>Loại</th><th>Số lượng</th><th>Giá</th>
                </tr>
              </thead>
              <tbody>
                {(selectedQuote?.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td><span className="tag">{REPAIR_ORDER_TYPE_LABELS[item.type] || item.type}</span></td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Phân công kỹ thuật viên</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-500)', textTransform: 'none' }}>Chọn một hoặc nhiều kỹ thuật viên</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {technicians.map((t) => {
              const isSelected = selectedTechnicianIds.includes(t.id);
              const level = SKILL_LEVEL_LABELS[t.skillLevel];
              return (
                <div
                  key={t.id}
                  onClick={() => toggleTechnician(t.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleTechnician(t.id); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    border: '1px solid', borderColor: isSelected ? 'var(--primary)' : 'var(--gray-200)',
                    background: isSelected ? 'var(--primary-very-light)' : 'var(--white)',
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? 'var(--primary)' : 'var(--gray-200)',
                    color: isSelected ? 'white' : 'var(--gray-500)', fontWeight: 700, fontSize: 13,
                  }}>
                    {isSelected ? '✓' : t.fullName.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{t.specialty}</div>
                  </div>
                  <span className={`badge ${level?.badge}`}>{level?.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="summary-box" style={{ position: 'sticky', top: 16 }}>
          <div className="form-section-title" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>Thông tin lệnh sửa chữa</div>

          <div style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Xe và khách hàng</div>
            <div>{selectedQuote?.vehicle?.licensePlate}</div>
            <div>{selectedQuote?.vehicle?.vehicleModel} · {(selectedQuote?.vehicle?.currentKm || 0).toLocaleString()} km</div>
            <div>{selectedQuote?.customer?.fullName}</div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label required">Mức độ ưu tiên</label>
            <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Ghi chú cho kỹ thuật viên</label>
            <textarea
              className="form-textarea"
              placeholder="Chú ý kỹ thuật, lưu ý đặc biệt…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div style={{
            background: selectedTechnicians.length ? '#E8F5E9' : 'var(--gray-100)',
            border: `1px solid ${selectedTechnicians.length ? '#A5D6A7' : 'var(--gray-300)'}`,
            borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: selectedTechnicians.length ? '#2E7D32' : 'var(--gray-600)' }}>
              {selectedTechnicians.length ? '✅ Đã phân công' : 'Chưa chọn kỹ thuật viên nào'}
            </div>
            {selectedTechnicians.map((t) => (
              <div key={t.id} style={{ color: 'var(--gray-700)' }}>👤 {t.fullName} — {t.specialty}</div>
            ))}
          </div>

          {saveError && (
            <div style={{ fontSize: 12, color: '#C62828', marginBottom: 10 }}>⚠️ {saveError}</div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            disabled={!canConfirm || saving}
            onClick={handleConfirm}
          >
            🔧 {saving ? 'Đang xác nhận…' : 'Xác nhận lệnh sửa chữa'}
          </button>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/repair-orders')}>
            ← Quay lại
          </button>
        </div>
      </div>

      {showQuotePicker && (
        <div className="modal-overlay" onClick={() => setShowQuotePicker(false)}>
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Chọn phiếu báo giá</h3>
              <button className="modal-close" onClick={() => setShowQuotePicker(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {quotes.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => { setSelectedQuoteId(q.id); setShowQuotePicker(false); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedQuoteId(q.id); setShowQuotePicker(false); } }}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid', borderColor: q.id === selectedQuoteId ? 'var(--primary)' : 'var(--gray-200)',
                      background: q.id === selectedQuoteId ? 'var(--primary-very-light)' : 'var(--white)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{q.code} — {q.customer?.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{q.vehicle?.licensePlate} · {q.vehicle?.vehicleModel}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-700)', marginTop: 2 }}>Tổng cộng: <b>{formatCurrency(q.total)}</b></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowQuotePicker(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RepairOrderPage() {
  return (
    <Routes>
      <Route index element={<RepairOrderList />} />
      <Route path="create" element={<RepairOrderCreate />} />
    </Routes>
  );
}
