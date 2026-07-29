import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { formatCurrency } from '../../utils';
import { listRepairSettlementsApi, getRepairSettlementApi } from '../../services/repairSettlementApi';
import {
  listTeamLeadersApi,
  listRepairOrdersApi,
  createRepairOrderApi,
  updateRepairOrderStatusApi,
  updateRepairOrderTaskApi,
} from '../../services/repairOrderApi';
import { ROLES } from '../../constants/roles';
import './RepairOrderPage.css';

const LHSC_LABELS = { DV: 'Dịch vụ', PT: 'Phụ tùng', BH: 'Bảo hành', HD: 'Hợp đồng' };
// "pending_assignment" là trạng thái ảo (không lưu ở BE) cho các phiếu quyết
// toán đã ở trạng thái "Chờ sửa chữa" nhưng CHƯA có lệnh sửa chữa/tổ trưởng.
const STATUS_LABELS = {
  pending_assignment: { label: 'Đang chờ phân công', badge: 'badge-pending' },
  inprogress: { label: 'Đang sửa chữa', badge: 'badge-inprogress' },
  completed: { label: 'Hoàn thành', badge: 'badge-completed' },
  cancelled: { label: 'Hủy', badge: 'badge-cancelled' },
};

// 2 tab trang thai cho man To truong (giong kieu pill-tab co dem so luong o
// trang Phieu quyet toan sua chua) - to truong chi can phan biet viec dang
// lam va viec da xong, khong can xem "huy" o day.
const TEAM_LEADER_TABS = [
  { key: 'inprogress', label: 'Đang sửa chữa' },
  { key: 'completed', label: 'Hoàn thành' },
];
const TEAM_LEADER_ACTIVE_TAB_COLOR = '#E65100';

// ─── Modal xác nhận hoàn thành 1 đầu mục công việc (To truong) - thay cho
// window.confirm cua trinh duyet de dong bo giao dien voi phan con lai cua app ──
function ConfirmDoneModal({ taskName, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Xác nhận hoàn thành</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 14 }}>Bạn đã hoàn thành xong đầu việc:</p>
          <p style={{ margin: '8px 0 0', fontWeight: 700, fontSize: 15 }}>{taskName}</p>
          <p style={{ marginTop: 12, fontSize: 12.5, color: 'var(--gray-600)' }}>
            Sau khi xác nhận sẽ không sửa lại được.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Hủy</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Đang lưu…' : 'Xác nhận hoàn thành'}
          </button>
        </div>
      </div>
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
      listRepairSettlementsApi({ status: 'waiting_repair', limit: 100, scope: 'branch' }),
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

  // Sau khi phan cong xong, chuyen thang sang tab "Dang sua chua" cua man
  // Phieu quyet toan luon (khong can man xac nhan trung gian nua) - phieu vua
  // tao lenh da tu chuyen sang "inprogress" nen se thay ngay o do. Muon in
  // danh sach cong viec cho to truong thi bam "In danh sach CV" ngay tai dong
  // do (RepairSettlementList), khong can lam o man nay nua.
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
      navigate('/repair-settlement', { state: { tab: 'inprogress' } });
    } catch (err) {
      setSaveError(err.message || 'Tạo lệnh sửa chữa thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Đang tải dữ liệu…</div>;
  if (loadError) return <div className="page-loading">{loadError}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Tạo lệnh sửa chữa</h1>
          <div className="breadcrumb"><Link to="/repair-settlement">Phiếu quyết toán sửa chữa</Link> / Tạo lệnh sửa chữa</div>
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
            <b>Phiếu quyết toán đã được chọn</b>
            <div style={{ fontSize: 12, color: 'var(--gray-700)', marginTop: 2 }}>
              {selectedSettlementDetail.customer?.fullName} — {selectedSettlementDetail.vehicle?.licensePlate} &nbsp;|&nbsp;
              Mã phiếu: <b>{selectedSettlementDetail.code}</b> &nbsp;|&nbsp; Tổng cộng: <b>{formatCurrency(selectedSettlementDetail.total)}</b>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowSettlementPicker(true)}>Đổi phiếu quyết toán</button>
        </div>
      )}

      {selectedSettlementDetail && (
        <div className="responsive-2col" style={{ gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
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
                      {t.fullName.charAt(0)}
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
                {selectedTeamLeader ? 'Đã phân công' : 'Chưa chọn tổ trưởng'}
              </div>
              {selectedTeamLeader && (
                <div style={{ color: 'var(--gray-700)' }}>{selectedTeamLeader.fullName} — {selectedTeamLeader.specialty}</div>
              )}
            </div>

            {saveError && (
              <div style={{ fontSize: 12, color: '#C62828', marginBottom: 10 }}>{saveError}</div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
              disabled={!canConfirm || saving}
              onClick={handleConfirm}
            >
              {saving ? 'Đang xác nhận…' : 'Xác nhận lệnh sửa chữa'}
            </button>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/repair-settlement')}>
              Quay lại
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

// ─── Tổ trưởng: "Công việc của tôi" - dạng card, tick từng đầu mục ────
// BE đã tự lọc GET /repair-orders theo team_leader_id = user hiện tại nên
// không cần truyền tham số gì thêm - danh sách trả về luôn là của chính mình.
function TeamLeaderTaskCards() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [filterStatus, setFilterStatus] = useState('inprogress');
  // Chi ap dung cho tab "Hoan thanh" - danh sach phieu da xong se ngay cang
  // dai theo thoi gian, can loc bot theo thang cho de tim.
  const [completedMonth, setCompletedMonth] = useState('');
  const [busyTaskKey, setBusyTaskKey] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { order, task } - dang cho xac nhan hoan thanh

  // silent=true dung cho auto-refresh nen (poll/focus lai tab) - khong bat
  // loading/spinner de tranh giat man hinh khi khong co gi thay doi.
  const loadAll = ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setLoadError('');
    return listRepairOrdersApi()
      .then((data) => setOrders(data || []))
      .catch((err) => { if (!silent) setLoadError(err.message || 'Không tải được danh sách công việc'); })
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    loadAll().then(() => {}).catch(() => {});
    // Poll 20s + refresh khi quay lai tab van giu lam luoi an toan (phong khi
    // SSE ben duoi bi mat ket noi tam thoi) - nhung duong chinh de thay lenh
    // moi la SSE 'assigned' (realtime, khong can cho toi vong poll).
    const intervalId = setInterval(() => loadAll({ silent: true }), 20000);
    const onFocus = () => loadAll({ silent: true });
    const onVisibility = () => { if (document.visibilityState === 'visible') loadAll({ silent: true }); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Realtime: CVDV vua tao lenh sua chua va gan cho DUNG minh -> nap lai
  // danh sach ngay, khong can cho poll 20s hay F5 tay.
  const handleRepairOrderEvent = (event) => {
    if (event.type === 'assigned' && String(event.teamLeaderId) === String(user?.id)) {
      loadAll({ silent: true });
    }
  };
  useRepairOrderEventsSSE(handleRepairOrderEvent, Boolean(user));

  // completedAt dang "dd/mm/yyyy" (BE tra san qua toDDMMYYYY) - cat lay
  // "mm/yyyy" de gom theo thang, sap xep giam dan (thang gan nhat truoc).
  const completedMonthOptions = Array.from(new Set(
    orders.filter((o) => o.status === 'completed' && o.completedAt).map((o) => o.completedAt.slice(3))
  )).sort((a, b) => {
    const [am, ay] = a.split('/').map(Number);
    const [bm, by] = b.split('/').map(Number);
    return by !== ay ? by - ay : bm - am;
  });

  const filteredOrders = orders.filter((o) => {
    if (o.status !== filterStatus) return false;
    if (filterStatus === 'completed' && completedMonth && o.completedAt?.slice(3) !== completedMonth) return false;
    return true;
  });
  const tabCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  // Tich xong la chot luon, khong bo tich lai duoc (checkbox tu khoa ngay sau
  // khi tich - xem disabled={... || task.isDone} o cho render) nen ham nay
  // trong thuc te chi con chay theo chieu tich (false -> true). Xac nhan qua
  // modal rieng cua app (ConfirmDoneModal) thay vi window.confirm cua trinh
  // duyet, dong bo giao dien voi phan con lai cua he thong.
  const toggleTask = async (order, task) => {
    const key = `${order.id}-${task.id}`;
    setBusyTaskKey(key);
    setActionError('');
    try {
      const updated = await updateRepairOrderTaskApi(order.id, task.id, true);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err) {
      setActionError(err.message || 'Không cập nhật được đầu mục công việc');
    } finally {
      setBusyTaskKey(null);
    }
  };

  const handleConfirmDone = async () => {
    if (!confirmTarget) return;
    await toggleTask(confirmTarget.order, confirmTarget.task);
    setConfirmTarget(null);
  };

  const handleComplete = async (order) => {
    setBusyOrderId(order.id);
    setActionError('');
    try {
      await updateRepairOrderStatusApi(order.id, 'completed');
      await loadAll();
    } catch (err) {
      setActionError(err.message || 'Không đánh dấu hoàn thành được');
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Công việc của tôi</h1>
          <div className="breadcrumb">Trang chủ / Công việc của tôi</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {TEAM_LEADER_TABS.map((t) => {
          const isActive = filterStatus === t.key;
          const count = tabCounts[t.key] ?? 0;
          return (
            <button key={t.key} onClick={() => setFilterStatus(t.key)}
              style={{
                padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '2px solid',
                borderColor: isActive ? TEAM_LEADER_ACTIVE_TAB_COLOR : 'var(--gray-300)',
                background: isActive ? TEAM_LEADER_ACTIVE_TAB_COLOR : 'var(--gray-100)',
                color: isActive ? 'white' : 'var(--gray-700)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {t.label}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.3)' : 'var(--gray-300)',
                color: isActive ? 'white' : 'var(--gray-600)',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{count}</span>
            </button>
          );
        })}
        {filterStatus === 'completed' && completedMonthOptions.length > 0 && (
          <select className="form-select" style={{ width: 150 }} value={completedMonth} onChange={(e) => setCompletedMonth(e.target.value)}>
            <option value="">Tất cả các tháng</option>
            {completedMonthOptions.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)' }}>
          {filteredOrders.length} / {orders.length} công việc
        </div>
      </div>

      {(loadError || actionError) && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#C62828' }}>
          {loadError || actionError}
        </div>
      )}

      {loading && (
        <div className="empty-state"><p>Đang tải danh sách công việc…</p></div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>Chưa có công việc nào được giao</h3>
        </div>
      )}

      <div className="team-leader-card-grid">
        {filteredOrders.map((order) => {
          const st = STATUS_LABELS[order.status] || { label: order.status, badge: 'badge-inactive' };
          const tasks = order.tasks || [];
          // Chi "cong viec" (dich vu) moi can tich hoan thanh - phu tung chi
          // hien thi de to truong biet can dung phu tung gi, khong phai tick.
          const serviceTasks = tasks.filter((t) => t.taskType === 'service');
          const partTasks = tasks.filter((t) => t.taskType !== 'service');
          const doneCount = serviceTasks.filter((t) => t.isDone).length;
          const allDone = serviceTasks.length > 0 && doneCount === serviceTasks.length;
          const isActive = order.status === 'inprogress';

          return (
            <div
              key={order.id}
              className="team-leader-order-card"
              style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 16, boxShadow: 'var(--shadow-sm)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8, flexShrink: 0 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)', fontSize: 14 }}>{order.code}</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{order.customer?.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{order.vehicle?.licensePlate} · {order.vehicle?.vehicleModel}</div>
                </div>
                <span className={`badge ${st.badge}`}>{st.label}</span>
              </div>

              {order.notes && (
                <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: '8px 10px', fontSize: 12, marginBottom: 12, flexShrink: 0 }}>
                  {order.notes}
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6, flexShrink: 0 }}>
                Đầu mục công việc ({doneCount}/{serviceTasks.length})
              </div>
              <div className="team-leader-tasklist" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: partTasks.length > 0 ? 10 : 14, paddingRight: 2 }}>
                {serviceTasks.map((task) => {
                  const key = `${order.id}-${task.id}`;
                  const isBusy = busyTaskKey === key;
                  return (
                    <label
                      key={task.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        background: task.isDone ? '#E8F5E9' : 'var(--gray-50)', borderRadius: 6,
                        fontSize: 13, cursor: isActive ? 'pointer' : 'default',
                        textDecoration: task.isDone ? 'line-through' : 'none',
                        color: task.isDone ? '#2E7D32' : 'var(--gray-900)',
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={task.isDone}
                        disabled={!isActive || isBusy || task.isDone}
                        onChange={() => setConfirmTarget({ order, task })}
                      />
                      <span>{task.taskName}</span>
                    </label>
                  );
                })}
              </div>

              {partTasks.length > 0 && (
                <div style={{ marginBottom: 14, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>
                    Phụ tùng cần dùng
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', paddingRight: 2 }}>
                    {partTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px',
                          background: 'var(--gray-50)', borderRadius: 6, fontSize: 12, color: 'var(--gray-700)',
                        }}
                      >
                        <span>{task.taskName}</span>
                        {task.quantity > 1 && <span style={{ color: 'var(--gray-500)' }}>x{task.quantity}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isActive && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', flexShrink: 0 }}
                  disabled={!allDone || busyOrderId === order.id}
                  title={!allDone ? 'Cần tích hoàn thành tất cả đầu mục trước' : ''}
                  onClick={() => handleComplete(order)}
                >
                  {busyOrderId === order.id ? 'Đang xử lý…' : 'Hoàn thành'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirmTarget && (
        <ConfirmDoneModal
          taskName={confirmTarget.task.taskName}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleConfirmDone}
        />
      )}
    </div>
  );
}

export default function RepairOrderPage() {
  const { user } = useAuth();
  if (user?.primaryRole === ROLES.TEAM_LEADER) {
    return <TeamLeaderTaskCards />;
  }
  return (
    <Routes>
      {/* Da bo man "Danh sach lenh sua chua" rieng - CVDV theo doi trang thai
          qua cac tab cua man Phieu quyet toan sua chua roi, /repair-orders
          (index) gio chi con dung de vao "create" (luc bam Phan cong). */}
      <Route index element={<Navigate to="/repair-settlement" replace />} />
      <Route path="create" element={<RepairOrderCreate />} />
    </Routes>
  );
}
