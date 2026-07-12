import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { formatCurrency } from '../../utils';
import { listRepairSettlementsApi, getRepairSettlementApi, updateRepairSettlementStatusApi } from '../../services/repairSettlementApi';
import {
  listTeamLeadersApi,
  listRepairOrdersApi,
  createRepairOrderApi,
  getRepairOrderApi,
  updateRepairOrderStatusApi,
} from '../../services/repairOrderApi';

const LHSC_LABELS = { DV: 'Dịch vụ', PT: 'Phụ tùng', BH: 'Bảo hành', HD: 'Hợp đồng' };
// "pending_assignment" là trạng thái ảo (không lưu ở BE) cho các phiếu quyết
// toán đã ở trạng thái "Chờ sửa chữa" nhưng CHƯA có lệnh sửa chữa/tổ trưởng.
const STATUS_LABELS = {
  pending_assignment: { label: 'Đang chờ phân công', badge: 'badge-pending' },
  in_progress: { label: 'Đang sửa chữa', badge: 'badge-inprogress' },
  completed: { label: 'Hoàn thành', badge: 'badge-completed' },
  cancelled: { label: 'Hủy', badge: 'badge-cancelled' },
};
// Cùng 1 chiều cao/kiểu cho mọi nút trong cột Thao tác (dù nút có icon+chữ
// hay chỉ icon) để hàng lối thẳng hàng, không bị lệch cao thấp giữa các nút.
const ACTION_BTN_STYLE = { height: 28, padding: '0 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' };
const ACTION_ICON_BTN_STYLE = { ...ACTION_BTN_STYLE, width: 28, padding: 0, justifyContent: 'center' };

// ─── Modal xem chi tiết phiếu quyết toán (dòng đang chờ phân công) ───
function PendingSettlementDetailModal({ settlementId, onClose }) {
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📋 Phiếu quyết toán {detail?.code || ''}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-pending">Đang chờ phân công</span>
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
                  <div className="form-section-title">Khách hàng & xe</div>
                  {[
                    ['Khách hàng', detail.customer?.fullName],
                    ['Điện thoại', detail.customer?.phone],
                    ['Biển số xe', detail.vehicle?.licensePlate],
                    ['Loại xe', detail.vehicle?.vehicleModel],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <div className="detail-label" style={{ width: 130, fontSize: 11 }}>{l}</div>
                      <div className="detail-value" style={{ fontSize: 12 }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="form-section-title">Thông tin phiếu</div>
                  {[
                    ['Cố vấn dịch vụ', detail.advisor],
                    ['Ngày tiếp nhận', detail.date],
                    ['Tổng cộng', formatCurrency(detail.total)],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <div className="detail-label" style={{ width: 130, fontSize: 11 }}>{l}</div>
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
              <div className="table-wrapper" style={{ marginBottom: 0 }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>#</th><th>Nội dung</th><th>Loại</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
                  </thead>
                  <tbody>
                    {(detail.items || []).map((item, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: 'center' }}>{i + 1}</td>
                        <td>{item.description}</td>
                        <td><span className="tag">{LHSC_LABELS[item.lhsc] || item.lhsc}</span></td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

// ─── Modal xem chi tiết lệnh sửa chữa ────────────────────────────────
function RepairOrderDetailModal({ orderId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getRepairOrderApi(orderId)
      .then((result) => { if (alive) setDetail(result); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được chi tiết lệnh sửa chữa'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orderId]);

  const st = detail && (STATUS_LABELS[detail.status] || { label: detail.status, badge: 'badge-inactive' });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🔧 Lệnh sửa chữa {detail?.code || ''}</h3>
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
                  <div className="form-section-title">Khách hàng & xe</div>
                  {[
                    ['Khách hàng', detail.customer?.fullName],
                    ['Biển số xe', detail.vehicle?.licensePlate],
                    ['Loại xe', detail.vehicle?.vehicleModel],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <div className="detail-label" style={{ width: 130, fontSize: 11 }}>{l}</div>
                      <div className="detail-value" style={{ fontSize: 12 }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="form-section-title">Phụ trách</div>
                  {[
                    ['Tổ trưởng', detail.teamLeader?.fullName],
                    ['Chuyên môn', detail.teamLeader?.specialty],
                    ['Người tạo lệnh', detail.createdByName],
                    ['Ngày tạo', detail.createdAt],
                    ['Ngày hoàn thành', detail.completedAt || '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <div className="detail-label" style={{ width: 130, fontSize: 11 }}>{l}</div>
                      <div className="detail-value" style={{ fontSize: 12 }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {detail.notes && (
                <>
                  <div className="form-section-title">Ghi chú cho tổ trưởng</div>
                  <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 16 }}>
                    {detail.notes}
                  </div>
                </>
              )}

              {detail.cancelReason && (
                <>
                  <div className="form-section-title">Lý do hủy</div>
                  <div style={{ background: '#FFEBEE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 16, color: '#C62828' }}>
                    {detail.cancelReason}
                  </div>
                </>
              )}

              <div className="form-section-title">Hạng mục công việc</div>
              <div className="table-wrapper" style={{ marginBottom: 0 }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>#</th><th>Nội dung</th><th>Loại</th><th>SL</th><th>Đơn giá</th><th>Xong</th></tr>
                  </thead>
                  <tbody>
                    {(detail.tasks || []).map((t, i) => (
                      <tr key={t.id}>
                        <td style={{ textAlign: 'center' }}>{i + 1}</td>
                        <td>{t.taskName}</td>
                        <td><span className="tag">{t.taskTypeLabel}</span></td>
                        <td style={{ textAlign: 'center' }}>{t.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(t.unitPrice)}</td>
                        <td style={{ textAlign: 'center' }}>{t.isDone ? '✅' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

// ─── Modal nhập lý do hủy (thay cho window.confirm) ──────────────────
function CancelReasonModal({ title, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err.message || 'Hủy thất bại');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🚫 {title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Lý do hủy</label>
            <textarea
              className="form-textarea"
              placeholder="Nhập lý do khách hủy…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
          {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>← Trở lại</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Đang xử lý…' : '✔ Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Danh sách lệnh sửa chữa ──────────────────────────────────────────
// Gộp 2 nguồn dữ liệu vào 1 danh sách duy nhất: (1) phiếu quyết toán đang
// "Chờ sửa chữa" nhưng CHƯA có lệnh sửa chữa/tổ trưởng -> hiển thị trạng thái
// ảo "Đang chờ phân công"; (2) các lệnh sửa chữa thật đã tạo (Đang sửa chữa /
// Hoàn thành / Hủy). Nhờ vậy cố vấn dịch vụ thấy toàn bộ luồng và thao tác
// được ngay trên 1 màn hình, không cần nút "Tạo lệnh sửa chữa" riêng nữa.
function RepairOrderList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [viewOrderId, setViewOrderId] = useState(null);
  const [viewSettlementId, setViewSettlementId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // { kind: 'order' | 'pending', id }

  const loadAll = () => {
    setLoading(true);
    return Promise.all([
      listRepairSettlementsApi({ status: 'waiting_repair', limit: 100 }),
      listRepairSettlementsApi({ status: 'cancelled', limit: 100 }),
      listRepairOrdersApi(),
    ])
      .then(([waitingResult, cancelledResult, orderResult]) => {
        setPendingSettlements([...(waitingResult.items || []), ...(cancelledResult.items || [])]);
        setOrders(orderResult || []);
      })
      .catch((err) => setLoadError(err.message || 'Không tải được danh sách lệnh sửa chữa'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    loadAll().then(() => {}).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const pendingRows = pendingSettlements.map((s) => ({
      kind: 'pending',
      id: s.id,
      code: s.code,
      customer: s.customer,
      vehicle: s.vehicle,
      teamLeader: null,
      status: s.status === 'cancelled' ? 'cancelled' : 'pending_assignment',
      date: s.date,
    }));
    const orderRows = orders.map((o) => ({
      kind: 'order',
      id: o.id,
      code: o.code,
      customer: o.customer,
      vehicle: o.vehicle,
      teamLeader: o.teamLeader,
      status: o.status,
      date: o.createdAt,
    }));
    return [...pendingRows, ...orderRows];
  }, [pendingSettlements, orders]);

  const handleAssign = (settlementId) => {
    navigate('/repair-orders/create', { state: { settlementId } });
  };

  const handleMarkComplete = async (id) => {
    setBusyId(id);
    setActionError('');
    try {
      await updateRepairOrderStatusApi(id, 'completed');
      await loadAll();
    } catch (err) {
      setActionError(err.message || 'Không đánh dấu hoàn thành được');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmCancel = async (reason) => {
    const { kind, id } = cancelTarget;
    setBusyId(id);
    setActionError('');
    try {
      if (kind === 'pending') {
        await updateRepairSettlementStatusApi(id, 'cancelled', reason);
      } else {
        await updateRepairOrderStatusApi(id, 'cancelled', reason);
      }
      setCancelTarget(null);
      await loadAll();
    } finally {
      setBusyId(null);
    }
  };

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
        </div>
      </div>

      {(loadError || actionError) && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#C62828' }}>
          ⚠️ {loadError || actionError}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Số lệnh / phiếu</th><th>Khách hàng</th><th>Xe</th>
              <th>Tổ trưởng phụ trách</th><th>Trạng thái</th><th>Ngày</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}>
                <div className="empty-state"><p>Đang tải danh sách lệnh sửa chữa…</p></div>
              </td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Chưa có lệnh sửa chữa nào</h3>
                  <p>Chưa có phiếu quyết toán nào đang chờ sửa chữa, và chưa có lệnh sửa chữa nào được tạo.</p>
                </div>
              </td></tr>
            )}
            {rows.map((r) => {
              const st = STATUS_LABELS[r.status] || { label: r.status, badge: 'badge-inactive' };
              const isBusy = busyId === r.id;
              return (
                <tr key={`${r.kind}-${r.id}`}>
                  <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{r.code}</span></td>
                  <td>{r.customer?.fullName}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.vehicle?.licensePlate}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.vehicle?.vehicleModel}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {r.teamLeader ? <span>👨‍🔧 {r.teamLeader.fullName}</span> : <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Chưa phân công</span>}
                  </td>
                  <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                  <td style={{ fontSize: 12 }}>{r.date}</td>
                  <td>
                    <div className="table-actions" style={{ flexWrap: 'nowrap' }}>
                      {r.kind === 'pending' && r.status === 'pending_assignment' && (
                        <>
                          <button className="btn btn-primary btn-sm" style={ACTION_BTN_STYLE} onClick={() => handleAssign(r.id)}>📋 Phân công</button>
                          <button className="btn btn-danger btn-sm" style={ACTION_BTN_STYLE} disabled={isBusy} onClick={() => setCancelTarget({ kind: 'pending', id: r.id })}>🚫 Hủy</button>
                          <button className="btn btn-secondary btn-sm" style={ACTION_ICON_BTN_STYLE} title="Xem chi tiết phiếu" onClick={() => setViewSettlementId(r.id)}>👁️</button>
                        </>
                      )}
                      {r.kind === 'pending' && r.status === 'cancelled' && (
                        <button className="btn btn-secondary btn-sm" style={ACTION_ICON_BTN_STYLE} title="Xem chi tiết phiếu" onClick={() => setViewSettlementId(r.id)}>👁️</button>
                      )}
                      {r.kind === 'order' && r.status === 'in_progress' && (
                        <>
                          <button className="btn btn-primary btn-sm" style={ACTION_BTN_STYLE} disabled={isBusy} onClick={() => handleMarkComplete(r.id)}>✅ Hoàn thành</button>
                          <button className="btn btn-danger btn-sm" style={ACTION_BTN_STYLE} disabled={isBusy} onClick={() => setCancelTarget({ kind: 'order', id: r.id })}>🚫 Hủy</button>
                          <button className="btn btn-secondary btn-sm" style={ACTION_ICON_BTN_STYLE} title="Xem chi tiết lệnh" onClick={() => setViewOrderId(r.id)}>👁️</button>
                        </>
                      )}
                      {r.kind === 'order' && r.status !== 'in_progress' && (
                        <button className="btn btn-secondary btn-sm" style={ACTION_ICON_BTN_STYLE} title="Xem chi tiết lệnh" onClick={() => setViewOrderId(r.id)}>👁️</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewOrderId && (
        <RepairOrderDetailModal orderId={viewOrderId} onClose={() => setViewOrderId(null)} />
      )}
      {viewSettlementId && (
        <PendingSettlementDetailModal settlementId={viewSettlementId} onClose={() => setViewSettlementId(null)} />
      )}
      {cancelTarget && (
        <CancelReasonModal
          title={cancelTarget.kind === 'pending' ? 'Hủy phiếu quyết toán' : 'Hủy lệnh sửa chữa'}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Tạo lệnh sửa chữa: gán tổ trưởng phụ trách ──────────────────────
function RepairOrderCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedSettlementId = location.state?.settlementId ?? null;
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
        const preselected = preselectedSettlementId && items.some((s) => s.id === preselectedSettlementId);
        setSelectedSettlementId(preselected ? preselectedSettlementId : (items[0]?.id ?? null));
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
