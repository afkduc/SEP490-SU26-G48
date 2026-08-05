// To truong (dang nhap chinh tai khoan cua ho). 3 tab:
// - Viec cho nhan: bang tin realtime cac phieu quyet toan chua ai nhan sua
//   chua. Bam "Nhan viec" se gan cho 1 khoang cua chinh to truong (chi cac
//   khoang dang ranh) roi bat buoc chon tho thuc hien ngay.
// - Khoang xe cua toi: khoang nao dang ranh/dang ban, dang ban thi lam don
//   gi, tien do tick dau muc ra sao - phan anh dung realtime nhung gi dang
//   duoc tick tai man hinh cong khai cua khoang do (Landing /khoang/<chi
//   nhanh>/<so khoang>), chi xem, khong tick duoc tu day.
// - Lich su: cac lenh da hoan thanh cua to truong, loc theo ngay.
import { useCallback, useEffect, useState } from 'react';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { listRepairSettlementsApi } from '../../services/repairSettlementApi';
import { listMyBaysApi } from '../../services/vehicleBayApi';
import {
  claimRepairOrderApi,
  listMyRepairOrdersApi,
  searchTechniciansApi,
  setRepairOrderTechniciansApi,
} from '../../services/repairOrderApi';
import './TeamLeaderDashboard.css';

const POLL_INTERVAL_MS = 15000;
const BAY_REFRESH_EVENT_TYPES = new Set(['claimed', 'order-completed', 'order-cancelled']);
const ORDER_REFRESH_EVENT_TYPES = new Set(['claimed', 'task-updated', 'order-completed', 'order-cancelled']);

const TABS = [
  { key: 'pending', label: 'Việc chờ nhận' },
  { key: 'bays', label: 'Khoang xe của tôi' },
  { key: 'history', label: 'Lịch sử' },
];

// completedAt tra ve tu BE dang "dd/mm/yyyy" - can quy doi qua lai voi gia
// tri "yyyy-mm-dd" cua <input type="date">.
function formatDDMMYYYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}
function ddmmyyyyToInputValue(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}
function inputValueToDDMMYYYY(value) {
  const [yyyy, mm, dd] = value.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// Sau khi chon khoang (da claim() thanh cong o BE - khong the huy giua
// chung), bat buoc phai gan xong tho moi duoc dong modal - khop voi viec
// man hinh khoang xe cong khai (BayScreen.jsx) tu nay chi con hien
// ActiveJobPanel, khong con TechnicianPickerModal rieng nua.
function ClaimModal({ settlement, bays, onClose, onDone }) {
  const [step, setStep] = useState('bay'); // 'bay' | 'technicians'
  const [selectedBay, setSelectedBay] = useState(null);
  const [claimedOrder, setClaimedOrder] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step !== 'technicians' || !query.trim()) { setSuggestions([]); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      searchTechniciansApi(query.trim())
        .then((data) => {
          if (!alive) return;
          const pickedIds = new Set(selectedTechs.map((t) => t.id));
          setSuggestions((data || []).filter((t) => !pickedIds.has(t.id)));
        })
        .catch(() => { if (alive) setSuggestions([]); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedTechs, step]);

  const handlePickBay = async (bay) => {
    setClaiming(true);
    setError('');
    try {
      const order = await claimRepairOrderApi(settlement.id, bay.id, bay.bayNumber);
      setSelectedBay(bay);
      setClaimedOrder(order);
      setStep('technicians');
    } catch (err) {
      setError(err.message || 'Nhận việc thất bại, có thể phiếu vừa được nhận.');
    } finally {
      setClaiming(false);
    }
  };

  const addTechnician = (tech) => {
    if (tech.busy) return;
    setSelectedTechs((prev) => (prev.some((t) => t.id === tech.id) ? prev : [...prev, tech]));
    setQuery('');
    setSuggestions([]);
  };

  const removeTechnician = (techId) => {
    setSelectedTechs((prev) => prev.filter((t) => t.id !== techId));
  };

  const handleConfirmTechnicians = async () => {
    if (selectedTechs.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await setRepairOrderTechniciansApi(claimedOrder.id, selectedTechs.map((t) => t.id));
      onDone();
    } catch (err) {
      setError(err.message || 'Không gán được thợ thực hiện');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-header">
          <span className="modal-title">Nhận việc — {settlement.code}</span>
          {step === 'bay' && (
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          )}
        </div>
        <div className="modal-body">
          {step === 'bay' && (
            <>
              <p className="form-hint" style={{ marginTop: 0 }}>Chọn khoang xe đang rảnh để nhận việc này.</p>
              {bays.length === 0 ? (
                <div className="tld-empty">Bạn chưa được gán khoang xe nào. Liên hệ Quản lý chi nhánh.</div>
              ) : (
                <div className="tld-bay-picker">
                  {bays.map((bay) => {
                    const busy = Boolean(bay.activeRepairOrderId);
                    return (
                      <button
                        key={bay.id}
                        type="button"
                        disabled={busy || claiming}
                        className={`tld-bay-picker__tile ${busy ? 'tld-bay-picker__tile--busy' : ''}`}
                        onClick={() => handlePickBay(bay)}
                      >
                        <span className="tld-bay-picker__number">Khoang {bay.bayNumber}</span>
                        <span className="tld-bay-picker__status">{busy ? 'Đang bận' : 'Trống'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 'technicians' && (
            <>
              <p className="form-hint" style={{ marginTop: 0 }}>
                Đã nhận vào Khoang {selectedBay?.bayNumber}. Nhập tên thợ thực hiện (có thể chọn nhiều thợ).
              </p>

              {selectedTechs.length > 0 && (
                <div className="tld-tech-chips">
                  {selectedTechs.map((t) => (
                    <span key={t.id} className="tld-tech-chip">
                      <b>{t.fullName}</b>
                      {t.phone && <span className="tld-tech-chip__phone"> · {t.phone}</span>}
                      {!t.sameTeam && <span className="tld-tech-chip__other-team"> (Tổ khác - điều động)</span>}
                      <button type="button" className="tld-tech-chip__remove" onClick={() => removeTechnician(t.id)}>✕</button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <input
                  autoFocus
                  className="form-input"
                  placeholder="Gõ tên thợ máy để thêm…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {suggestions.length > 0 && (
                  <div className="tld-tech-suggestions">
                    {suggestions.map((t) => (
                      <div
                        key={t.id}
                        className={`tld-tech-suggestions__item ${t.busy ? 'tld-tech-suggestions__item--busy' : ''}`}
                        onMouseDown={() => addTechnician(t)}
                      >
                        <b>{t.fullName}</b>
                        {t.phone && <span className="tld-tech-suggestions__phone"> — {t.phone}</span>}
                        {!t.sameTeam && <span className="tld-tech-suggestions__other-team"> (Tổ khác - điều động)</span>}
                        {t.busy && <span className="tld-tech-suggestions__busy"> (Đang bận lệnh khác)</span>}
                      </div>
                    ))}
                  </div>
                )}
                {query.trim() && suggestions.length === 0 && (
                  <div className="form-hint">Không tìm thấy thợ nào khớp tên.</div>
                )}
              </div>
            </>
          )}

          {error && <div className="tld-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        {step === 'technicians' && (
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={selectedTechs.length === 0 || submitting}
              onClick={handleConfirmTechnicians}
            >
              {submitting ? 'Đang lưu…' : 'Xác nhận'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Xem (khong tick duoc) - tick that su dien ra tai man hinh cong khai cua
// dung khoang do (Landing), o day chi phan anh lai realtime qua SSE
// 'task-updated'/danh sach orders duoc nap lai.
function BayStatusGrid({ bays, orders }) {
  if (bays.length === 0) {
    return <div className="tld-empty">Bạn chưa được gán khoang xe nào. Liên hệ Quản lý chi nhánh.</div>;
  }

  const activeByBayId = new Map(
    orders.filter((o) => o.status === 'inprogress').map((o) => [String(o.bayId), o])
  );

  return (
    <div className="tld-bay-status-grid">
      {bays.map((bay) => {
        const busy = Boolean(bay.activeRepairOrderId);
        const order = busy ? activeByBayId.get(String(bay.id)) : null;
        const serviceTasks = order ? (order.tasks || []).filter((t) => t.taskType === 'service') : [];
        const doneCount = serviceTasks.filter((t) => t.isDone).length;

        return (
          <div key={bay.id} className={`tld-bay-status-card ${busy ? 'tld-bay-status-card--busy' : ''}`}>
            <div className="tld-bay-status-card__header">
              <span className="tld-bay-status-card__number">Khoang {bay.bayNumber}</span>
              <span className={`badge ${busy ? 'badge-inprogress' : 'badge-inactive'}`}>
                {busy ? `Đang làm (${doneCount}/${serviceTasks.length})` : 'Trống'}
              </span>
            </div>

            {busy && !order && <div className="tld-empty">Đang tải tiến độ…</div>}

            {busy && order && (
              <>
                <div className="tld-bay-status-card__code">{order.code}</div>
                <div className="tld-bay-status-card__customer">{order.customer?.fullName} — {order.vehicle?.licensePlate}</div>
                {order.technicians?.length > 0 && (
                  <div className="tld-bay-status-card__tech">
                    Thợ: <b>{order.technicians.map((t) => (t.sameTeam ? t.fullName : `${t.fullName} (điều động)`)).join(', ')}</b>
                  </div>
                )}
                {serviceTasks.length > 0 && (
                  <div className="tld-bay-status-card__tasks">
                    {serviceTasks.map((task) => (
                      <label key={task.id} className={`tld-task ${task.isDone ? 'tld-task--done' : ''}`}>
                        <input type="checkbox" checked={task.isDone} readOnly disabled />
                        <span>{task.taskName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryPanel({ orders, bays }) {
  const [selectedDate, setSelectedDate] = useState(() => formatDDMMYYYY(new Date()));
  const isToday = selectedDate === formatDDMMYYYY(new Date());
  const completed = orders.filter((o) => o.status === 'completed');
  const filtered = completed.filter((o) => o.completedAt === selectedDate);
  const bayNumberOf = (o) => bays.find((b) => String(b.id) === String(o.bayId))?.bayNumber;

  return (
    <div>
      <div className="tld-history-filter">
        <input
          type="date"
          className="form-input"
          value={ddmmyyyyToInputValue(selectedDate)}
          onChange={(e) => e.target.value && setSelectedDate(inputValueToDDMMYYYY(e.target.value))}
        />
        {!isToday && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(formatDDMMYYYY(new Date()))}>
            Hôm nay
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state"><p>Không có việc nào hoàn thành ngày này.</p></div>
      ) : (
        <div className="tld-history-list">
          {filtered.map((o) => (
            <div key={o.id} className="tld-history-row">
              <div>
                <div className="tld-pending-card__code">{o.code}</div>
                <div className="tld-pending-card__customer">{o.customer?.fullName} — {o.vehicle?.licensePlate}</div>
                <div className="tld-pending-card__vehicle">Khoang {bayNumberOf(o) || '—'} · {o.vehicle?.vehicleModel}</div>
              </div>
              <div className="tld-history-row__date">{o.completedAt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamLeaderDashboard() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pending, setPending] = useState(null);
  const [bays, setBays] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [claimingSettlement, setClaimingSettlement] = useState(null);
  const [claimedElsewhere, setClaimedElsewhere] = useState({});

  const loadPending = useCallback(() => {
    listRepairSettlementsApi({ status: 'waiting_repair', scope: 'branch', limit: 200 })
      .then((result) => setPending(result.items || []))
      .catch((err) => setError(err.message || 'Không tải được bảng tin việc'));
  }, []);

  const loadBays = useCallback(() => {
    listMyBaysApi().then((data) => setBays(data || [])).catch(() => {});
  }, []);

  const loadOrders = useCallback(() => {
    listMyRepairOrdersApi().then((data) => setOrders(data || [])).catch(() => {});
  }, []);

  useEffect(() => { loadPending(); loadBays(); loadOrders(); }, [loadPending, loadBays, loadOrders]);

  // Poll du phong 15s - phong khi mat ket noi SSE tam thoi (vd BE restart,
  // mang chap chon) ma FE khong kip bat duoc su kien push, cac tab se ung
  // dong cho den lan F5 tiep theo neu khong co lop nay - cung pattern voi
  // BranchGateScreen.jsx (man bao ve).
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadPending();
      loadBays();
      loadOrders();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [loadPending, loadBays, loadOrders]);

  const handleEvent = useCallback((event) => {
    if (event.type === 'new-pending') {
      loadPending();
    }
    if (event.type === 'order-cancelled') {
      // Phieu con dang o bang tin (chua ai nhan) vua bi huy - tu xoa dong
      // tuong ung, khong can F5.
      setPending((prev) => (prev ? prev.filter((s) => s.id !== event.settlementId) : prev));
    }
    if (event.type === 'claimed') {
      // Doi dong tuong ung thanh "Khoang X da nhan" (ke ca khi chinh minh vua
      // nhan) roi tu bien mat sau 10s, khong xoa ngay de kip doc.
      setClaimedElsewhere((prev) => ({ ...prev, [event.settlementId]: event.bayNumber }));
      setTimeout(() => {
        setPending((prev) => (prev ? prev.filter((s) => s.id !== event.settlementId) : prev));
        setClaimedElsewhere((prev) => {
          const next = { ...prev };
          delete next[event.settlementId];
          return next;
        });
      }, 10000);
    }
    // 'task-updated' (tick tai man hinh khoang xe cong khai) va cac su kien
    // doi trang thai lenh deu can nap lai orders de tab "Khoang xe cua toi"/
    // "Lich su" phan anh dung realtime.
    if (ORDER_REFRESH_EVENT_TYPES.has(event.type)) {
      loadOrders();
    }
    if (BAY_REFRESH_EVENT_TYPES.has(event.type)) {
      loadBays();
    }
  }, [loadPending, loadBays, loadOrders]);

  useRepairOrderEventsSSE(handleEvent, true);

  const handleClaimDone = () => {
    setClaimingSettlement(null);
    loadPending();
    loadBays();
    loadOrders();
  };

  const activeTabLabel = TABS.find((t) => t.key === activeTab)?.label;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{activeTabLabel}</h1>
          <div className="breadcrumb">Trang chủ / {activeTabLabel}</div>
        </div>
      </div>

      <div className="tld-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tld-tab ${activeTab === t.key ? 'tld-tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="tld-error">{error}</div>}

      {activeTab === 'pending' && (
        pending === null ? (
          <div className="empty-state"><p>Đang tải…</p></div>
        ) : pending.length === 0 ? (
          <div className="empty-state">
            <h3>Chưa có đơn tiếp nhận mới</h3>
            <p>Các phiếu quyết toán vừa tiếp nhận sẽ hiện tại đây theo thời gian thực.</p>
          </div>
        ) : (
          <div className="tld-pending-grid">
            {pending.map((s) => {
              const claimedBay = claimedElsewhere[s.id];
              return (
                <div key={s.id} className="tld-pending-card">
                  <div className="tld-pending-card__header">
                    <span className="tld-pending-card__code">{s.code}</span>
                    <span className="tld-pending-card__date">Tiếp nhận: {s.date || '—'}</span>
                  </div>
                  <div className="tld-pending-card__customer">{s.customer?.fullName} — {s.vehicle?.licensePlate}</div>
                  <div className="tld-pending-card__vehicle">{s.vehicle?.vehicleModel}</div>
                  <div className="tld-pending-card__request">
                    <span className="tld-pending-card__request-label">Yêu cầu:</span> {s.customerRequest || '—'}
                  </div>
                  <div className="tld-pending-card__footer">
                    {claimedBay ? (
                      <span className="tld-pending-card__taken">Khoang {claimedBay} đã nhận</span>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={() => setClaimingSettlement(s)}>
                        Nhận việc
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'bays' && <BayStatusGrid bays={bays} orders={orders} />}

      {activeTab === 'history' && <HistoryPanel orders={orders} bays={bays} />}

      {claimingSettlement && (
        <ClaimModal
          settlement={claimingSettlement}
          bays={bays}
          onClose={() => setClaimingSettlement(null)}
          onDone={handleClaimDone}
        />
      )}
    </div>
  );
}
