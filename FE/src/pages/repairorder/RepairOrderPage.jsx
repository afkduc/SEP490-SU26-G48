import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { formatCurrency } from '../../utils';
import { listRepairSettlementsApi, getRepairSettlementApi } from '../../services/repairSettlementApi';
import { listTeamLeadersApi, listRepairOrdersApi, createRepairOrderApi } from '../../services/repairOrderApi';

const LHSC_LABELS = { DV: 'Dịch vụ', PT: 'Phụ tùng', BH: 'Bảo hành', HD: 'Hợp đồng' };
const STATUS_LABELS = {
  in_progress: { label: 'Đang sửa chữa', badge: 'badge-inprogress' },
  completed: { label: 'Hoàn thành', badge: 'badge-completed' },
};

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
      .then((result) => { if (alive) setOrders(result || []); })
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
            🏢 {user?.branchName || user?.branch}
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
              <th>Tổ trưởng phụ trách</th><th>Trạng thái</th><th>Ngày tạo</th>
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
                  <p>Nhấn "Tạo lệnh sửa chữa" để phân công tổ trưởng cho một phiếu quyết toán đang chờ sửa chữa.</p>
                </div>
              </td></tr>
            )}
            {orders.map((o) => {
              const st = STATUS_LABELS[o.status] || { label: o.status, badge: 'badge-inactive' };
              return (
                <tr key={o.id}>
                  <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{o.code}</span></td>
                  <td>{o.customer?.fullName}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.vehicle?.licensePlate}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{o.vehicle?.vehicleModel}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {o.teamLeader ? <span>👨‍🔧 {o.teamLeader.fullName}</span> : <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Chưa gán</span>}
                  </td>
                  <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                  <td style={{ fontSize: 12 }}>{o.createdAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tạo lệnh sửa chữa: gán tổ trưởng phụ trách ──────────────────────
function RepairOrderCreate() {
  const navigate = useNavigate();
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedSettlementId, setSelectedSettlementId] = useState(null);
  const [selectedSettlementDetail, setSelectedSettlementDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showSettlementPicker, setShowSettlementPicker] = useState(false);
  const [selectedTeamLeaderId, setSelectedTeamLeaderId] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      listRepairSettlementsApi({ status: 'waiting_repair', limit: 100 }),
      listTeamLeadersApi(),
    ])
      .then(([settlementResult, teamLeaderResult]) => {
        if (!alive) return;
        const items = settlementResult.items || [];
        setPendingSettlements(items);
        setTeamLeaders(teamLeaderResult || []);
        setSelectedSettlementId(items[0]?.id ?? null);
      })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được dữ liệu'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedSettlementId) { setSelectedSettlementDetail(null); return undefined; }
    let alive = true;
    setLoadingDetail(true);
    getRepairSettlementApi(selectedSettlementId)
      .then((detail) => { if (alive) setSelectedSettlementDetail(detail); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được chi tiết phiếu'); })
      .finally(() => { if (alive) setLoadingDetail(false); });
    return () => { alive = false; };
  }, [selectedSettlementId]);

  const selectedTeamLeader = useMemo(
    () => teamLeaders.find((t) => t.id === selectedTeamLeaderId) || null,
    [teamLeaders, selectedTeamLeaderId],
  );

  const canConfirm = Boolean(selectedSettlementId) && Boolean(selectedTeamLeaderId);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setSaveError('');
    try {
      await createRepairOrderApi({
        serviceOrderId: selectedSettlementId,
        teamLeaderId: selectedTeamLeaderId,
        notes,
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

      {!selectedSettlementId && (
        <div style={{ background: 'var(--gray-100)', border: '1px solid var(--gray-300)', borderRadius: 8, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: 'var(--gray-700)' }}>
          Hiện không có phiếu quyết toán nào đang ở trạng thái <b>Chờ sửa chữa</b> để tạo lệnh sửa chữa.
        </div>
      )}

      {selectedSettlementDetail && (
        <div style={{
          background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8,
          padding: '14px 18px', marginBottom: 16, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ fontSize: 13, color: '#2E7D32' }}>
            ✅ <b>Phiếu quyết toán đã được chọn</b>
            <div style={{ fontSize: 12, color: 'var(--gray-700)', marginTop: 2 }}>
              {selectedSettlementDetail.customer?.fullName} — {selectedSettlementDetail.vehicle?.licensePlate} &nbsp;|&nbsp;
              Mã phiếu: <b>{selectedSettlementDetail.code}</b> &nbsp;|&nbsp; Tổng cộng: <b>{formatCurrency(selectedSettlementDetail.total)}</b>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowSettlementPicker(true)}>Đổi phiếu quyết toán</button>
        </div>
      )}

      {selectedSettlementDetail && (
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
                  {loadingDetail && (
                    <tr><td colSpan={4}><div className="empty-state"><p>Đang tải chi tiết…</p></div></td></tr>
                  )}
                  {!loadingDetail && (selectedSettlementDetail.items || []).map((item, i) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td><span className="tag">{LHSC_LABELS[item.lhsc] || item.lhsc}</span></td>
                      <td>{item.qty}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Phân công tổ trưởng</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-500)', textTransform: 'none' }}>Chọn 1 tổ trưởng phụ trách chi nhánh này</span>
            </div>
            {teamLeaders.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)', fontStyle: 'italic' }}>Chi nhánh chưa có tổ trưởng nào đang hoạt động.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teamLeaders.map((t) => {
                const isSelected = selectedTeamLeaderId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTeamLeaderId(t.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTeamLeaderId(t.id); }}
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
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{t.specialty} · Tổ {t.teamSize} người</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="summary-box" style={{ position: 'sticky', top: 16 }}>
            <div className="form-section-title" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>Thông tin lệnh sửa chữa</div>

            <div style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Xe và khách hàng</div>
              <div>{selectedSettlementDetail.vehicle?.licensePlate}</div>
              <div>{selectedSettlementDetail.vehicle?.vehicleModel}</div>
              <div>{selectedSettlementDetail.customer?.fullName}</div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Ghi chú cho tổ trưởng</label>
              <textarea
                className="form-textarea"
                placeholder="Chú ý kỹ thuật, lưu ý đặc biệt…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{
              background: selectedTeamLeader ? '#E8F5E9' : 'var(--gray-100)',
              border: `1px solid ${selectedTeamLeader ? '#A5D6A7' : 'var(--gray-300)'}`,
              borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: selectedTeamLeader ? '#2E7D32' : 'var(--gray-600)' }}>
                {selectedTeamLeader ? '✅ Đã phân công' : 'Chưa chọn tổ trưởng'}
              </div>
              {selectedTeamLeader && (
                <div style={{ color: 'var(--gray-700)' }}>👤 {selectedTeamLeader.fullName} — {selectedTeamLeader.specialty}</div>
              )}
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
      )}

      {showSettlementPicker && (
        <div className="modal-overlay" onClick={() => setShowSettlementPicker(false)}>
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Chọn phiếu quyết toán chờ sửa chữa</h3>
              <button className="modal-close" onClick={() => setShowSettlementPicker(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingSettlements.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedSettlementId(s.id); setShowSettlementPicker(false); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedSettlementId(s.id); setShowSettlementPicker(false); } }}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid', borderColor: s.id === selectedSettlementId ? 'var(--primary)' : 'var(--gray-200)',
                      background: s.id === selectedSettlementId ? 'var(--primary-very-light)' : 'var(--white)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{s.code} — {s.customer?.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{s.vehicle?.licensePlate} · {s.vehicle?.vehicleModel}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-700)', marginTop: 2 }}>Tổng cộng: <b>{formatCurrency(s.total)}</b></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSettlementPicker(false)}>Đóng</button>
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
