// Man hinh to truong - kiosk cham tren man hinh gan tuong tai tung khoang xe.
// Dang nhap chung 1 tai khoan to truong cho nhieu khoang cung luc (xem
// AuthService.login()). deviceId sinh MOI (khong luu localStorage) moi lan
// component nay mount - tuc la moi lan dang nhap lai deu la 1 "phien" moi,
// bat buoc phai chon lai khoang, khong tu dong nhay thang vao khoang cu.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AppContext';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { listMyBaysApi, occupyBayApi, releaseBayApi, heartbeatBayApi } from '../../services/vehicleBayApi';
import { listRepairSettlementsApi } from '../../services/repairSettlementApi';
import {
  claimRepairOrderApi,
  getRepairOrderApi,
  listRepairOrdersApi,
  searchTechniciansApi,
  setRepairOrderTechniciansApi,
  updateRepairOrderStatusApi,
  updateRepairOrderTaskApi,
} from '../../services/repairOrderApi';
import './TeamLeaderKiosk.css';

function generateDeviceId() {
  return crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Khop voi BE (bayHeartbeatCleanupJob.js: nha khoang sau 15s khong heartbeat) -
// bao dinh ky voi chu ky ngan hon (5s) de mat 1-2 lan bao lien tiep (mat
// mang tam thoi) van khong bi nha oan, phat hien mat ket noi thuc su trong
// khoang ~20s.
const HEARTBEAT_INTERVAL_MS = 5 * 1000;

// completedAt tra ve tu BE dang "dd/mm/yyyy" (toDDMMYYYY) - can quy doi qua
// lai voi gia tri "yyyy-mm-dd" cua <input type="date">.
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

function BaySelectScreen({ bays, onSelect, error, loading, teamLeaderName, onLogout }) {
  return (
    <div className="kiosk-center">
      <div className="kiosk-team-leader-name">Tổ trưởng: {teamLeaderName}</div>
      <h1 className="kiosk-title">Chọn khoang xe</h1>
      {error && <div className="kiosk-error">{error}</div>}
      {bays.length === 0 ? (
        <div className="kiosk-empty">Bạn chưa được gán khoang xe nào. Liên hệ Quản lý chi nhánh.</div>
      ) : (
        <div className="kiosk-bay-grid">
          {bays.map((bay) => {
            // 1 khoang chi 1 thiet bi giu tai 1 thoi diem, ke ca giua nhieu
            // thiet bi cua cung 1 to truong - da occupied la khoa, khong
            // phan biet "cua minh hay cua nguoi khac".
            const busy = Boolean(bay.occupiedByDeviceId);
            return (
              <button
                key={bay.id}
                type="button"
                disabled={busy || loading}
                className={`kiosk-bay-tile ${busy ? 'kiosk-bay-tile--busy' : ''}`}
                onClick={() => onSelect(bay)}
              >
                <span className="kiosk-bay-tile__number">Khoang {bay.bayNumber}</span>
                <span className="kiosk-bay-tile__status">{busy ? 'Đang sử dụng' : 'Trống'}</span>
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className="kiosk-tab kiosk-tab--logout" onClick={onLogout}>Đăng xuất</button>
    </div>
  );
}

// Bat buoc chon tho thuc hien ngay sau khi nhan viec (truoc khi cho tick
// dau muc cong viec) - de biet dung ai da sua chiec xe nay. Co the chon
// NHIEU tho cung sua 1 xe (them lien tuc, moi nguoi 1 chip co nut xoa,
// giong kieu "Thanh vien doi" ben ManagerPage.jsx). Goi y chi lay tho trong
// doi cua to truong dang dang nhap (xem searchTechniciansApi), hien ca ten +
// so dien thoai vi co the trung ten giua cac tho.
function TechnicianPickerModal({ orderId, onAssigned }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      searchTechniciansApi(query.trim())
        .then((data) => {
          if (!alive) return;
          const pickedIds = new Set(selected.map((t) => t.id));
          setSuggestions((data || []).filter((t) => !pickedIds.has(t.id)));
        })
        .catch(() => { if (alive) setSuggestions([]); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selected]);

  const addTechnician = (tech) => {
    if (tech.busy) return; // dang lam lenh khac chua xong - khong cho chon tiep
    setSelected((prev) => (prev.some((t) => t.id === tech.id) ? prev : [...prev, tech]));
    setQuery('');
    setSuggestions([]);
  };

  const removeTechnician = (techId) => {
    setSelected((prev) => prev.filter((t) => t.id !== techId));
  };

  const handleConfirm = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const updated = await setRepairOrderTechniciansApi(orderId, selected.map((t) => t.id));
      onAssigned(updated);
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
          <span className="modal-title">Thợ thực hiện</span>
        </div>
        <div className="modal-body">
          <p className="form-hint" style={{ marginTop: 0 }}>Nhập tên thợ đang sửa xe này để lưu lại (có thể chọn nhiều thợ).</p>

          {selected.length > 0 && (
            <div className="kiosk-tech-chips">
              {selected.map((t) => (
                <span key={t.id} className="kiosk-tech-chip">
                  <b>{t.fullName}</b>
                  {t.phone && <span className="kiosk-tech-chip__phone"> · {t.phone}</span>}
                  {!t.sameTeam && <span className="kiosk-tech-chip__other-team"> (Tổ khác - điều động)</span>}
                  <button type="button" className="kiosk-tech-chip__remove" onClick={() => removeTechnician(t.id)}>✕</button>
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
              <div className="kiosk-tech-suggestions">
                {suggestions.map((t) => (
                  <div
                    key={t.id}
                    className={`kiosk-tech-suggestions__item ${t.busy ? 'kiosk-tech-suggestions__item--busy' : ''}`}
                    onMouseDown={() => addTechnician(t)}
                  >
                    <b>{t.fullName}</b>
                    {t.phone && <span className="kiosk-tech-suggestions__phone"> — {t.phone}</span>}
                    {!t.sameTeam && <span className="kiosk-tech-suggestions__other-team"> (Tổ khác - điều động)</span>}
                    {t.busy && <span className="kiosk-tech-suggestions__busy"> (Đang bận lệnh khác)</span>}
                  </div>
                ))}
              </div>
            )}
            {query.trim() && suggestions.length === 0 && (
              <div className="form-hint">Không tìm thấy thợ nào khớp tên.</div>
            )}
          </div>

          {error && <div className="kiosk-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" disabled={selected.length === 0 || submitting} onClick={handleConfirm}>
            {submitting ? 'Đang lưu…' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActiveJobPanel({ order, onTaskDone, onComplete, busyTaskId, completing }) {
  const tasks = order.tasks || [];
  const serviceTasks = tasks.filter((t) => t.taskType === 'service');
  const partTasks = tasks.filter((t) => t.taskType !== 'service');
  const doneCount = serviceTasks.filter((t) => t.isDone).length;
  const allDone = serviceTasks.length > 0 && doneCount === serviceTasks.length;

  return (
    <div className="kiosk-job">
      <div className="kiosk-job__header">
        <div>
          <div className="kiosk-job__code">{order.code}</div>
          <div className="kiosk-job__customer">{order.customer?.fullName}</div>
          <div className="kiosk-job__vehicle">{order.vehicle?.licensePlate} · {order.vehicle?.vehicleModel}</div>
          {order.technicians?.length > 0 && (
            <div className="kiosk-job__technician">
              Thợ thực hiện: <b>{order.technicians.map((t) => (t.sameTeam ? t.fullName : `${t.fullName} (Tổ khác - điều động)`)).join(', ')}</b>
            </div>
          )}
        </div>
      </div>

      {order.notes && <div className="kiosk-job__notes">{order.notes}</div>}

      <div className="kiosk-job__section-title">Đầu mục công việc ({doneCount}/{serviceTasks.length})</div>
      <div className="kiosk-job__tasklist">
        {serviceTasks.map((task) => (
          <label key={task.id} className={`kiosk-task ${task.isDone ? 'kiosk-task--done' : ''}`}>
            <input
              type="checkbox"
              checked={task.isDone}
              disabled={busyTaskId === task.id || task.isDone}
              onChange={() => onTaskDone(task)}
            />
            <span>{task.taskName}</span>
          </label>
        ))}
      </div>

      {partTasks.length > 0 && (
        <>
          <div className="kiosk-job__section-title">Phụ tùng cần dùng</div>
          <div className="kiosk-job__partlist">
            {partTasks.map((task) => (
              <div key={task.id} className="kiosk-part-row">
                <span>{task.taskName}</span>
                {task.quantity > 1 && <span className="kiosk-part-row__qty">x{task.quantity}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        className="btn btn-primary kiosk-job__complete"
        disabled={!allDone || completing}
        onClick={onComplete}
      >
        {completing ? 'Đang xử lý…' : 'Hoàn thành'}
      </button>
    </div>
  );
}

function HistoryPanel({ orders }) {
  // Mac dinh chi hien viec hoan thanh HOM NAY - muon xem ngay khac phai tu
  // chon qua bo loc ngay, khong liet ke tran lan tat ca lich su nhu truoc.
  const [selectedDate, setSelectedDate] = useState(() => formatDDMMYYYY(new Date()));
  const isToday = selectedDate === formatDDMMYYYY(new Date());
  const completed = orders.filter((o) => o.status === 'completed');
  const filtered = completed.filter((o) => o.completedAt === selectedDate);

  return (
    <div className="kiosk-history">
      <div className="kiosk-history__filter">
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
      {filtered.length === 0 && <div className="kiosk-empty">Không có việc nào hoàn thành ngày này.</div>}
      {filtered.map((o) => (
        <div key={o.id} className="kiosk-history-row">
          <div>
            <div className="kiosk-job__code">{o.code}</div>
            <div className="kiosk-job__customer">{o.customer?.fullName} — {o.vehicle?.licensePlate}</div>
          </div>
          <div className="kiosk-history-row__date">{o.completedAt}</div>
        </div>
      ))}
    </div>
  );
}

function BayJobBoard({ bay, deviceId, teamLeaderId, teamLeaderName, onLogout, onBayUpdated }) {
  const [tab, setTab] = useState('board'); // 'board' | 'history'
  const [pending, setPending] = useState(null);
  const [claimedElsewhere, setClaimedElsewhere] = useState({}); // settlementId -> bayNumber
  const [activeOrder, setActiveOrder] = useState(null);
  const [error, setError] = useState('');
  // Khach huy giua chung trong luc to truong dang thao tac (tick viec/Hoan
  // thanh) - BE tra ve code ORDER_CANCELLED kem ly do CVDV da nhap (xem
  // RepairOrderService.js: cancelledOrderError). Khac voi loi thong thuong,
  // truong hop nay phai co nut rieng de thoat khoi lenh da chet nay.
  const [cancelledInfo, setCancelledInfo] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);

  const loadPending = useCallback(() => {
    listRepairSettlementsApi({ status: 'waiting_repair', scope: 'branch', limit: 200 })
      .then((result) => setPending(result.items || []))
      .catch((err) => setError(err.message || 'Không tải được bảng tin việc'));
  }, []);

  const loadActiveOrder = useCallback(() => {
    if (!bay.activeRepairOrderId) { setActiveOrder(null); return; }
    getRepairOrderApi(bay.activeRepairOrderId)
      .then(setActiveOrder)
      .catch((err) => setError(err.message || 'Không tải được việc đang làm'));
  }, [bay.activeRepairOrderId]);

  const loadHistory = useCallback(() => {
    listRepairOrdersApi().then((data) => setHistoryOrders(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setCancelledInfo('');
    if (bay.activeRepairOrderId) {
      loadActiveOrder();
    } else {
      setPending(null);
      loadPending();
    }
  }, [bay.activeRepairOrderId, loadActiveOrder, loadPending]);

  useEffect(() => { loadHistory(); }, [loadHistory, bay.activeRepairOrderId]);

  const handleEvent = useCallback((event) => {
    if (event.type === 'new-pending' && !bay.activeRepairOrderId) {
      loadPending();
    }
    if (event.type === 'order-cancelled') {
      if (event.orderId && event.orderId === bay.activeRepairOrderId) {
        // Dung lenh khoang nay dang hien - bao ngay, khong doi den luc to
        // truong bam gi do that bai moi biet (xem RepairSettlementService.js).
        setCancelledInfo(`Phiếu đã bị hủy. Lý do: ${event.cancelReason || 'Không rõ lý do'}`);
        return;
      }
      // Phieu con dang o bang tin "Viec moi" (chua ai nhan) vua bi huy - tu
      // xoa dong tuong ung, khong can doi F5.
      setPending((prev) => (prev ? prev.filter((s) => s.id !== event.settlementId) : prev));
    }
    if (event.type === 'claimed') {
      if (event.bayId === bay.id) {
        // Khoang nay vua nhan thanh cong (do chinh minh bam, hoac tab khac
        // cua cung khoang) - nap lai bay de chuyen sang man viec dang lam.
        onBayUpdated();
        return;
      }
      // Bi khoang khac nhan truoc - doi dong tuong ung thanh "Khoang X da
      // nhan" roi tu bien mat sau 10s, khong xoa ngay de nguoi dang xem kip doc.
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
  }, [bay.id, bay.activeRepairOrderId, loadPending, onBayUpdated]);

  useRepairOrderEventsSSE(handleEvent, true);

  const handleClaim = async (settlementId) => {
    setClaimingId(settlementId);
    setError('');
    try {
      await claimRepairOrderApi(settlementId, bay.id, bay.bayNumber);
      onBayUpdated();
    } catch (err) {
      setError(err.message || 'Nhận việc thất bại, có thể phiếu vừa được khoang khác nhận.');
      loadPending();
    } finally {
      setClaimingId(null);
    }
  };

  const handleTaskDone = async (task) => {
    setBusyTaskId(task.id);
    try {
      const updated = await updateRepairOrderTaskApi(activeOrder.id, task.id, true);
      setActiveOrder(updated);
    } catch (err) {
      if (err.code === 'ORDER_CANCELLED') {
        setCancelledInfo(err.message);
      } else {
        setError(err.message || 'Không cập nhật được đầu mục công việc');
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError('');
    try {
      await updateRepairOrderStatusApi(activeOrder.id, 'completed');
      onBayUpdated();
    } catch (err) {
      if (err.code === 'ORDER_CANCELLED') {
        setCancelledInfo(err.message);
      } else {
        setError(err.message || 'Không đánh dấu hoàn thành được');
      }
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="kiosk-board">
      <div className="kiosk-team-leader-name">Tổ trưởng: {teamLeaderName}</div>
      <div className="kiosk-board__topbar">
        <div className="kiosk-board__bay-label">Khoang {bay.bayNumber}</div>
        <div className="kiosk-board__tabs">
          <button type="button" className={`kiosk-tab ${tab === 'board' ? 'kiosk-tab--active' : ''}`} onClick={() => setTab('board')}>
            {bay.activeRepairOrderId ? 'Đang làm' : 'Việc mới'}
          </button>
          <button type="button" className={`kiosk-tab ${tab === 'history' ? 'kiosk-tab--active' : ''}`} onClick={() => setTab('history')}>
            Lịch sử
          </button>
          <button type="button" className="kiosk-tab kiosk-tab--logout" onClick={onLogout}>Đăng xuất</button>
        </div>
      </div>

      {cancelledInfo ? (
        <div className="kiosk-error kiosk-error--cancelled">
          <span>{cancelledInfo}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={onBayUpdated}>
            Về màn hình nhận việc mới
          </button>
        </div>
      ) : (
        error && <div className="kiosk-error">{error}</div>
      )}

      {tab === 'history' && <HistoryPanel orders={historyOrders} />}

      {tab === 'board' && bay.activeRepairOrderId && (
        !activeOrder
          ? <div className="kiosk-empty">Đang tải…</div>
          : !(activeOrder.technicians?.length > 0)
            ? <TechnicianPickerModal orderId={activeOrder.id} onAssigned={setActiveOrder} />
            : <ActiveJobPanel order={activeOrder} onTaskDone={handleTaskDone} onComplete={handleComplete} busyTaskId={busyTaskId} completing={completing} />
      )}

      {tab === 'board' && !bay.activeRepairOrderId && (
        pending === null ? (
          <div className="kiosk-empty">Đang tải…</div>
        ) : pending.length === 0 ? (
          <div className="kiosk-empty">Chưa có đơn tiếp nhận mới</div>
        ) : (
          <div className="kiosk-pending-grid">
            {pending.map((s) => {
              const claimedBay = claimedElsewhere[s.id];
              return (
                <div key={s.id} className="kiosk-pending-card">
                  <div className="kiosk-pending-card__header">
                    <span className="kiosk-job__code">{s.code}</span>
                    <span className="kiosk-pending-card__date">Tiếp nhận: {s.date || '—'}</span>
                  </div>
                  <div className="kiosk-job__customer">{s.customer?.fullName} — {s.vehicle?.licensePlate}</div>
                  <div className="kiosk-job__vehicle">{s.vehicle?.vehicleModel}</div>
                  <div className="kiosk-pending-card__request">
                    <span className="kiosk-pending-card__request-label">Yêu cầu:</span> {s.customerRequest || '—'}
                  </div>
                  <div className="kiosk-pending-card__footer">
                    {claimedBay ? (
                      <span className="kiosk-pending-row__taken">Khoang {claimedBay} đã nhận</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={claimingId === s.id}
                        onClick={() => handleClaim(s.id)}
                      >
                        {claimingId === s.id ? 'Đang nhận…' : 'Nhận việc'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

export default function TeamLeaderKiosk() {
  const { user, logout } = useAuth();
  const deviceId = useMemo(generateDeviceId, []);
  const [bays, setBays] = useState(null);
  const [activeBay, setActiveBay] = useState(null);
  const [error, setError] = useState('');
  const [occupying, setOccupying] = useState(false);

  const loadBays = useCallback(() => {
    return listMyBaysApi()
      .then((data) => {
        setBays(data || []);
        const mine = (data || []).find((b) => b.occupiedByDeviceId === deviceId);
        setActiveBay(mine || null);
      })
      .catch((err) => setError(err.message || 'Không tải được danh sách khoang xe'));
  }, [deviceId]);

  useEffect(() => { loadBays(); }, [loadBays]);

  // Realtime: khoang tren cac man hinh KHAC (tablet khac) vua bi chiem/nha ra
  // phai thay ngay o day, khong doi bam "Tai lai" tay moi thay - de tranh 2
  // tablet cung luc thay 1 khoang con trong roi cung bam chiem.
  const handleBayEvent = useCallback((event) => {
    if (event.type === 'bay-occupied' || event.type === 'bay-released') {
      loadBays();
    }
  }, [loadBays]);
  useRepairOrderEventsSSE(handleBayEvent, true);

  // Bao "van con song" dinh ky cho khoang dang giu - mat dien/rot mang thi
  // tablet nay don gian la ngung bao duoc, BE se tu nha khoang sau nguong
  // thoi gian (xem bayHeartbeatCleanupJob.js), khong can bam nut gi ca. Neu
  // heartbeat bao "khong con thuoc phien nay" (vd bi nha do qua han truoc
  // do, hoac bi Quan ly/CVDV force-release) thi tu quay lai man chon khoang.
  useEffect(() => {
    if (!activeBay) return undefined;
    const id = setInterval(() => {
      heartbeatBayApi(activeBay.id, deviceId).catch(() => {
        setActiveBay(null);
        loadBays();
      });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [activeBay, deviceId, loadBays]);

  const handleSelectBay = async (bay) => {
    setOccupying(true);
    setError('');
    try {
      const occupied = await occupyBayApi(bay.id, deviceId);
      setActiveBay(occupied);
    } catch (err) {
      setError(err.message || 'Không chiếm được khoang này, có thể đang có người dùng.');
      loadBays();
    } finally {
      setOccupying(false);
    }
  };

  // Khong con cho "Doi khoang" giua chung nua - muon doi khoang bat buoc phai
  // dang xuat roi dang nhap lai chon khoang khac (tranh 1 tablet nhay lung
  // tung giua nhieu khoang trong khi van con giu phien). Dang xuat luon nha
  // khoang dang giu truoc, de khoang do realtime hien lai "Trong" tren moi
  // man hinh khac ngay (khong phai doi ai do vao xoa thu cong).
  const handleLogout = async () => {
    if (activeBay) {
      try { await releaseBayApi(activeBay.id, deviceId); } catch { /* ignore */ }
    }
    await logout();
  };

  if (bays === null) {
    return <div className="kiosk-center"><div className="kiosk-empty">Đang tải…</div></div>;
  }

  if (!activeBay) {
    return (
      <BaySelectScreen
        bays={bays}
        onSelect={handleSelectBay}
        error={error}
        loading={occupying}
        teamLeaderName={user?.name}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <BayJobBoard
      bay={activeBay}
      deviceId={deviceId}
      teamLeaderId={user?.id}
      teamLeaderName={user?.name}
      onLogout={handleLogout}
      onBayUpdated={loadBays}
    />
  );
}
