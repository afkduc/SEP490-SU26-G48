// To truong (dang nhap chinh tai khoan cua ho). 3 tab:
// - Viec cho nhan: bang tin realtime cac phieu quyet toan chua ai nhan sua
//   chua. Bam "Nhan viec" se gan cho 1 khoang cua chinh to truong (chi cac
//   khoang dang ranh) roi bat buoc chon tho thuc hien ngay.
// - Khoang xe cua toi: khoang nao dang ranh/dang ban, dang ban thi lam don
//   gi, tien do tick dau muc ra sao - phan anh dung realtime nhung gi dang
//   duoc tick tai man hinh cong khai cua khoang do (Landing /bay/<chi
//   nhanh>/<so khoang>), chi xem, khong tick duoc tu day.
// - Lich su: cac lenh da hoan thanh cua to truong, loc theo ngay.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { actionLabel, OTHER_GROUP_LABEL } from '../../constants/maintenanceChecklist';
import { listRepairSettlementsApi } from '../../services/repairSettlementApi';
import { listMyBaysApi } from '../../services/vehicleBayApi';
import {
  claimRepairOrderApi,
  listMyRepairOrdersApi,
  searchTechniciansApi,
  setRepairOrderTechniciansApi,
  confirmRepairOrderCompleteApi,
  reopenRepairOrderTaskApi,
  forwardNgTaskApi,
} from '../../services/repairOrderApi';
import IntakeChecklistView from '../repairsettlement/IntakeChecklistView';
import './TeamLeaderDashboard.css';

const POLL_INTERVAL_MS = 15000;
// 'task-updated' = tho vua tick 1 dau muc o khoang - phai nap lai danh sach
// lenh de nut "Hoàn thành" mo khoa ngay khi du dau muc, khong doi vong poll.
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

// Hien thi 1 dau muc - hang muc bi khach huy giua chung (isCancelled) hoac
// moi duoc CVDV them vao SAU luc nhan viec (isAddedLater) ghi ro o cuoi ten,
// xem BE repairOrderTaskBuilder.js/computeDesiredTasks. Tach ten (co gach
// ngang neu huy) voi phan mo ngoac cuoi ten thanh 2 <span> ANH EM - phan mo
// ngoac KHONG duoc gach ngang, va text-decoration cua 1 the cha se "xuyen
// qua" moi span con du con tu dat text-decoration:none, nen khong the chi
// gop chung vao 1 chuoi roi gach ngang ca <label>/div cha.
// So luong GIAM so voi prev_quantity (khach hoan tra bot, khong phai huy han)
// - "SL xN" la CHENH LECH (khac "tổng là: N" cua truong hop TANG, vi TANG chi
// can biet tong moi con GIAM can biet ro tra lai bao nhieu). Giam het ve 0 (ma
// van chua qua "Khách hủy" chinh thuc, vd phu tung thao tra lai kho) thi coi
// nhu da tra lai toan bo - gach ngang giong isCancelled - xem BE
// RepairSettlementRepositoryImpl._syncRepairOrderTasks.
function qtyReturnedOf(t) {
  return t.prevQuantity != null && Number(t.quantity) < Number(t.prevQuantity)
    ? Number(t.prevQuantity) - Number(t.quantity)
    : 0;
}
function isFullyReturned(t) {
  return !t.isCancelled && qtyReturnedOf(t) > 0 && Number(t.quantity) === 0;
}
function isStruckThrough(t) {
  return t.isCancelled || isFullyReturned(t);
}

function TaskNameLabel({ t }) {
  const qtyReturned = qtyReturnedOf(t);
  const suffix = t.isCancelled
    ? ' (Khách hủy)'
    : qtyReturned > 0
      ? ` (Khách trả lại SL x${qtyReturned})`
      : t.isQtyIncreased
        ? ` (Khách thêm số lượng, tổng là: ${t.quantity})`
        : t.isAddedLater
          ? ' (Khách thêm)'
          : '';
  return (
    <>
      <span style={{ textDecoration: isStruckThrough(t) ? 'line-through' : 'none' }}>{t.taskName}</span>
      {suffix && <span style={{ textDecoration: 'none' }}>{suffix}</span>}
    </>
  );
}

// So luong + DON VI TINH cua dau muc phu tung: "4 Lít", "1 Cái"... Tho o
// khoang phai biet do 4 LIT dau hay lay 4 CAI bugi, chi so khong thi khong du.
// Dau muc dich vu khong co DVT va luon SL 1 -> tra ve rong, khong hien gi.
function qtyLabel(t) {
  const n = Number(t.quantity) || 0;
  if (!t.unit && n <= 1) return '';
  return `${n}${t.unit ? ` ${t.unit}` : ''}`;
}

// Gom dau muc dich vu theo NHOM CONG VIEC cua bieu mau "Phieu kiem tra bao
// duong dinh ky" (5 nhom: cac bo phan co ban cua dong co, he thong dien khoang
// dong co, he thong nhien lieu va kiem soat khi xa, gam va than xe, dieu hoa).
// Dau muc ngoai bieu mau (dich vu le khach yeu cau them) don xuong cuoi trong
// nhom "Hang muc khac". Giu nguyen thu tu checklist_order do BE sap san.
function groupServiceTasks(tasks) {
  const groups = [];
  const byName = new Map();
  for (const t of tasks) {
    const name = t.checklistGroup || OTHER_GROUP_LABEL;
    if (!byName.has(name)) {
      const g = { name, tasks: [], hasOrder: t.checklistGroup != null };
      byName.set(name, g);
      groups.push(g);
    }
    byName.get(name).tasks.push(t);
  }
  // "Hang muc khac" luon o cuoi du dong dau tien cua phieu la dich vu le.
  return groups.sort((a, b) => Number(a.name === OTHER_GROUP_LABEL) - Number(b.name === OTHER_GROUP_LABEL));
}

// Dong phu duoi ten dau muc: yeu cau thuc hien (ghi hẳn chữ, không hiện mã
// I/R/M/V) va ket qua kiem tra Dat/Khong dat + mo ta khi Khong dat.
function TaskMeta({ t }) {
  const label = actionLabel(t.actionCode);
  if (!label && !t.checkResult) return null;
  return (
    <>
      {label && <div className="tld-task__action">{label}</div>}
      {t.checkResult && (
        <div className={`tld-task__result tld-task__result--${t.checkResult === 'NG' ? 'ng' : 'ok'}`}>
          {t.checkResult === 'NG' ? 'Không đạt' : 'Đạt'}
          {t.checkResult === 'NG' && t.checkNote ? ` — ${t.checkNote}` : ''}
        </div>
      )}
    </>
  );
}

// Duong di cua 1 dau muc bi cham "Khong dat": tho bao -> TO TRUONG xem lai
// roi bao co van -> co van goi khach. Khoang xe khong noi thang duoc voi co
// van, nen o day to truong luon la nguoi bam nut chuyen tiep.
// Xem ensureNgDecision.js + RepairOrderService.forwardNgTask.
function NgActionBox({ task, onForwardNg, forwardingTaskId }) {
  if (task.checkResult !== 'NG') return null;

  if (task.ngDecision === 'reported') {
    return (
      <div className="tld-ng-box tld-ng-box--todo">
        <div className="tld-ng-box__title">Thợ báo cần thay — chờ bạn chuyển cố vấn</div>
        <button
          type="button"
          className="btn btn-warning btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={forwardingTaskId === task.id}
          onClick={() => onForwardNg(task)}
        >
          {forwardingTaskId === task.id ? 'Đang gửi…' : 'Báo cố vấn dịch vụ'}
        </button>
      </div>
    );
  }
  if (task.ngDecision === 'pending') {
    return <div className="tld-ng-box tld-ng-box--waiting">Đã báo cố vấn — chờ cố vấn trao đổi với khách</div>;
  }
  if (task.ngDecision === 'accepted') {
    // Khach dong y thay = con nguyen phan THAY THE chua ai lam, BE mo lai dau
    // muc (is_done=0). Chua thay xong thi day la viec dang cho, khong phai
    // viec da khep lai - phai nhin ra ngay.
    return task.isDone
      ? <div className="tld-ng-box tld-ng-box--ok">Khách đồng ý thay — thợ đã thay xong</div>
      : <div className="tld-ng-box tld-ng-box--todo">Khách đồng ý thay — chờ thợ thay và tích hoàn thành</div>;
  }
  if (task.ngDecision === 'declined') {
    return (
      <div className="tld-ng-box tld-ng-box--declined">
        Khách từ chối thay{task.ngNote ? ` — ${task.ngNote}` : ''}
      </div>
    );
  }
  return null;
}

// Chon (nhieu) tho cho 1 lenh sua chua - tach rieng khoi ClaimModal de dung
// chung duoc voi AssignTechniciansModal (gan BO SUNG tho cho 1 khoang DA
// claim() tu truoc nhung dang khong co tho nao, xem comment o do).
function TechnicianPicker({ selectedTechs, setSelectedTechs }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return undefined; }
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
  }, [query, selectedTechs]);

  const addTechnician = (tech) => {
    if (tech.busy) return;
    setSelectedTechs((prev) => (prev.some((t) => t.id === tech.id) ? prev : [...prev, tech]));
    setQuery('');
    setSuggestions([]);
  };

  const removeTechnician = (techId) => {
    setSelectedTechs((prev) => prev.filter((t) => t.id !== techId));
  };

  return (
    <>
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
  );
}

// Sau khi chon khoang (da claim() thanh cong o BE - khong the huy giua
// chung), bat buoc phai gan xong tho moi duoc dong modal - khop voi viec
// man hinh khoang xe cong khai (BayScreen.jsx) tu nay chi con hien
// ActiveJobPanel, khong con TechnicianPickerModal rieng nua. Neu to truong
// dong tab/F5 giua chung o buoc nay (da claim() nhung chua gan tho), lenh se
// "ket" o Khoang xe cua toi voi 0 tho - xem AssignTechniciansModal ben duoi
// de go ket tiep sau, khong bi mat luon kha nang gan tho.
function ClaimModal({ settlement, bays, onClose, onDone }) {
  const [step, setStep] = useState('bay'); // 'bay' | 'technicians'
  const [selectedBay, setSelectedBay] = useState(null);
  const [claimedOrder, setClaimedOrder] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const [selectedTechs, setSelectedTechs] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Canh bao truoc khi dong tab/F5 luc da claim() xong nhung chua gan tho -
  // vao thoi diem nay lenh da that su "inprogress" tren BE roi, roi trang se
  // mat het state wizard va khong con nut Xac nhan nao de bam nua (van go ket
  // duoc sau qua "Gan tho" o tab Khoang xe cua toi, nhung tot hon la canh bao
  // som de to truong khong vo tinh roi trang som).
  useEffect(() => {
    if (step !== 'technicians') return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [step]);

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
              <TechnicianPicker selectedTechs={selectedTechs} setSelectedTechs={setSelectedTechs} />
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

// Gan BO SUNG tho cho 1 khoang DA claim() tu truoc nhung dang khong co tho
// nao (vd to truong dong tab/F5 giua chung o buoc chon tho cua ClaimModal -
// claim() da khong the huy giua chung, nen lenh "ket" o Khoang xe cua toi
// voi 0 tho, khong con wizard nao mo san de hoan tat nua). BE cho gan tho
// vao bat ky luc nao lenh con "inprogress" (khong bat buoc phai la lan gan
// dau tien - xem RepairOrderService.setTechnicians), nen mo lai duoc o day
// bang chinh TechnicianPicker dung chung voi ClaimModal.
function AssignTechniciansModal({ order, onClose, onDone }) {
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (selectedTechs.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await setRepairOrderTechniciansApi(order.id, selectedTechs.map((t) => t.id));
      onDone();
    } catch (err) {
      setError(err.message || 'Không gán được thợ thực hiện');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Gán thợ — Khoang {order.bayNumber}</span>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="form-hint" style={{ marginTop: 0 }}>
            {order.customer?.fullName} — {order.vehicle?.licensePlate}. Nhập tên thợ thực hiện (có thể chọn nhiều thợ).
          </p>
          <TechnicianPicker selectedTechs={selectedTechs} setSelectedTechs={setSelectedTechs} />
          {error && <div className="tld-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedTechs.length === 0 || submitting}
            onClick={handleConfirm}
          >
            {submitting ? 'Đang lưu…' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Xem (khong tick duoc) - tick that su dien ra tai man hinh cong khai cua
// dung khoang do (Landing), o day chi phan anh lai realtime qua SSE
// 'task-updated'/danh sach orders duoc nap lai.
function BayStatusGrid({ bays, orders, onAssignTechnicians, onConfirmComplete, confirmingId, onReopenTask, reopeningTaskId, onForwardNg, forwardingTaskId }) {
  const [intakeOrder, setIntakeOrder] = useState(null);
  // Goi bao duong bung ra 30+ dau muc, 3 khoang cung luc la phai cuon rat
  // lau moi xem het. Cho thu gon tung khoang lai - chi la trang thai hien
  // thi nen khong can luu, va luon giu lai dong khach hang/bien so de con
  // biet khoang nao dang lam xe nao.
  const [collapsedBays, setCollapsedBays] = useState(() => new Set());
  const toggleBay = (bayId) => setCollapsedBays((prev) => {
    const next = new Set(prev);
    if (next.has(bayId)) next.delete(bayId); else next.add(bayId);
    return next;
  });

  if (bays.length === 0) {
    return <div className="tld-empty">Bạn chưa được gán khoang xe nào. Liên hệ Quản lý chi nhánh.</div>;
  }

  // Lenh dang chiem khoang gom CA 2 trang thai: dang lam ('inprogress') va da
  // Lenh dang chiem khoang - xe van
  // nam trong khoang cho den khi xac nhan, va chinh o trang thai thu 2 moi
  // hien nut "Xác nhận hoàn thành" ben duoi.
  const activeByBayId = new Map(
    orders
      .filter((o) => o.status === 'inprogress')
      .map((o) => [String(o.bayId), o])
  );

  return (
    <div className="tld-bay-status-grid">
      {bays.map((bay) => {
        const busy = Boolean(bay.activeRepairOrderId);
        const order = busy ? activeByBayId.get(String(bay.id)) : null;
        const serviceTasks = order ? (order.tasks || []).filter((t) => t.taskType === 'service') : [];
        const partTasks = order ? (order.tasks || []).filter((t) => t.taskType !== 'service') : [];
        const activeServiceTasks = serviceTasks.filter((t) => !t.isCancelled);
        const doneCount = activeServiceTasks.filter((t) => t.isDone).length;
        // Khoang da bam Hoan thanh nhung to truong chua xac nhan - khoang van
        // tinh la dang ban (xe chua ra), chi doi nhan de biet la den luot minh.
        // Tho da tick het dau muc dich vu -> to truong bam "Hoàn thành" duoc.
        // Khoang xe khong co nut ket thuc, buoc nay chi to truong lam.
        const xongHet = activeServiceTasks.length > 0 && doneCount === activeServiceTasks.length;
        // Dau muc "Khong dat" con dang di tren duong bao khach - BE chan bam
        // Hoan thanh (xem RepairOrderService._assertCompletable), o day chan
        // luon o giao dien de to truong biet con thieu gi thay vi bam roi an loi.
        const ngChuaBao = activeServiceTasks.filter((t) => t.ngDecision === 'reported');
        const ngChoKhach = activeServiceTasks.filter((t) => t.ngDecision === 'pending');
        const vuongNg = ngChuaBao.length + ngChoKhach.length > 0;
        const thuGon = collapsedBays.has(bay.id);

        return (
          <div key={bay.id} className={`tld-bay-status-card ${busy ? 'tld-bay-status-card--busy' : ''}${thuGon ? ' tld-bay-status-card--collapsed' : ''}`}>
            <div className="tld-bay-status-card__header">
              <div className="tld-bay-head-left">
                {busy && (
                  <button type="button" className="tld-bay-collapse"
                    onClick={() => toggleBay(bay.id)}
                    title={thuGon ? 'Mở lại khoang này' : 'Thu gọn khoang này'}
                    style={{ transform: thuGon ? 'none' : 'rotate(90deg)' }}>▶</button>
                )}
                <span className="tld-bay-status-card__number">Khoang {bay.bayNumber}</span>
                {/* Thu gon: ca khung khoang co lai con dung thanh nay, nen
                    ghep luon khach hang + bien so vao de van biet khoang nao
                    dang lam xe nao ma khong phai mo ra. */}
                {thuGon && order && (
                  <span className="tld-bay-collapsed-hint">
                    {order.customer?.fullName} — {order.vehicle?.licensePlate}
                    {vuongNg ? ` · ${ngChuaBao.length + ngChoKhach.length} mục không đạt` : ''}
                  </span>
                )}
              </div>
              <span className={`badge ${xongHet ? 'badge-pending' : (busy ? 'badge-inprogress' : 'badge-inactive')}`}>
                {xongHet
                  ? 'Chờ xác nhận'
                  : (busy ? `Đang làm (${doneCount}/${activeServiceTasks.length})` : 'Trống')}
              </span>
            </div>

            {busy && !order && !thuGon && <div className="tld-empty">Đang tải tiến độ…</div>}

            {busy && order && !thuGon && (
              <>
                <div className="tld-bay-status-card__customer">Khách hàng: {order.customer?.fullName} — {order.vehicle?.licensePlate}</div>
                {order.advisorName && (
                  <div className="tld-bay-status-card__advisor">CVDV: <b>{order.advisorName}</b></div>
                )}
                {order.technicians?.length > 0 ? (
                  <div className="tld-bay-status-card__tech">
                    Thợ: <b>{order.technicians.map((t) => (t.sameTeam ? t.fullName : `${t.fullName} (điều động)`)).join(', ')}</b>
                  </div>
                ) : (
                  // Da claim() bay nhung chua co tho nao - thuong xay ra khi to
                  // truong dong tab/F5 giua chung o buoc chon tho luc Nhan viec.
                  // Khong tu bien mat, phai chu dong Gan tho moi tick/hoan
                  // thanh duoc (xem cac guard o RepairOrderService).
                  <div className="tld-bay-status-card__no-tech">
                    <span>Chưa gán thợ thực hiện!</span>
                    <button type="button" className="btn btn-warning btn-sm" onClick={() => onAssignTechnicians(order)}>
                      Gán thợ
                    </button>
                  </div>
                )}
                {serviceTasks.length > 0 && (
                  <div className="tld-bay-status-card__tasks">
                    {groupServiceTasks(serviceTasks).map((group) => (
                      <div key={group.name} className="tld-task-group">
                        <div className="tld-task-group__title">{group.name}</div>
                        {group.tasks.map((task) => {
                          // To truong khong tu tich (viec do lam tai khoang),
                          // nhung DUOC GO TICH dau muc da xong de yeu cau lam
                          // lai - thay cho 1 nut "tra ve lam tiep" rieng.
                          const canReopen = task.isDone && !task.isCancelled;
                          return (
                          <div key={task.id} className="tld-task-wrap">
                          <label
                            className={`tld-task ${isStruckThrough(task) ? 'tld-task--cancelled' : (task.isDone ? 'tld-task--done' : '')}`}
                            title={canReopen ? 'Gỡ tích để yêu cầu làm lại đầu mục này' : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={task.isDone}
                              readOnly={!canReopen}
                              disabled={!canReopen || reopeningTaskId === task.id}
                              onChange={canReopen ? () => onReopenTask(order, task) : undefined}
                            />
                            <div className="tld-task__body">
                              <div className="tld-task__nameRow">
                                <TaskNameLabel t={task} />
                                {qtyLabel(task) && <span className="tld-task__qty">{qtyLabel(task)}</span>}
                              </div>
                              <TaskMeta t={task} />
                              {task.note && <div className="tld-task__note">{task.note}</div>}
                            </div>
                          </label>
                          <NgActionBox task={task} onForwardNg={(t) => onForwardNg(order, t)} forwardingTaskId={forwardingTaskId} />
                          </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {partTasks.length > 0 && (
                  <>
                    <div className="tld-bay-status-card__parts-title">Phụ tùng cần dùng</div>
                    <div className="tld-bay-status-card__parts">
                      {partTasks.map((task) => (
                        <div key={task.id} className={`tld-part ${isStruckThrough(task) ? 'tld-task--cancelled' : ''}`}>
                          <div className="tld-task__body">
                            <div className="tld-task__nameRow">
                              <TaskNameLabel t={task} />
                            </div>
                            {task.note && <div className="tld-task__note">{task.note}</div>}
                          </div>
                          {qtyLabel(task) && <span className="tld-task__qty">{qtyLabel(task)}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                  onClick={() => setIntakeOrder(order)}
                >
                  Xem tình trạng xe ban đầu
                </button>

                {/* Tho da tick het dau muc. Khoang xe KHONG co nut ket thuc -
                    phieu quyet toan van "Đang sửa chữa" ben CVDV cho den khi
                    to truong bam nut nay. Xem RepairOrderService.confirmCompleted. */}
                {xongHet && (
                  <div className="tld-confirm-box">
                    <div className="tld-confirm-box__title">Thợ đã xong tất cả đầu mục</div>
                    {vuongNg ? (
                      <div className="tld-confirm-box__blocked">
                        Chưa đóng lệnh được — xe không được rời xưởng khi khách chưa được báo:
                        {ngChuaBao.length > 0 && (
                          <div>• {ngChuaBao.length} đầu mục chưa báo cố vấn: {ngChuaBao.map((t) => t.taskName).join(', ')}</div>
                        )}
                        {ngChoKhach.length > 0 && (
                          <div>• {ngChoKhach.length} đầu mục cố vấn đang hỏi khách: {ngChoKhach.map((t) => t.taskName).join(', ')}</div>
                        )}
                      </div>
                    ) : (
                      <div className="tld-confirm-box__hint">
                        Kiểm tra lại rồi bấm Hoàn thành để chuyển phiếu sang <b>Chờ thanh toán</b> và giải phóng khoang.
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={confirmingId === order.id || vuongNg}
                      onClick={() => onConfirmComplete(order)}
                    >
                      {confirmingId === order.id ? 'Đang xử lý…' : 'Hoàn thành'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {intakeOrder && (
        <div className="modal-overlay" onClick={() => setIntakeOrder(null)}>
          <div
            className="modal modal-xl no-scrollbar"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 'min(680px, 54vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <span className="modal-title">Tiếp nhận và bàn giao xe — {intakeOrder.customer?.fullName}</span>
              <button type="button" className="modal-close" onClick={() => setIntakeOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              <IntakeChecklistView value={intakeOrder.intakeChecklist} vehicleModelText={intakeOrder.vehicle?.vehicleModel} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Xem lai 1 lenh da hoan thanh trong Lich su - khach da sua nhung gi (dich
// vu/phu tung, kem so luong voi hang phu tung), tho nao lam, khoang nao.
function HistoryDetailModal({ order, onClose }) {
  const serviceTasks = (order.tasks || []).filter((t) => t.taskType === 'service');
  const partTasks = (order.tasks || []).filter((t) => t.taskType !== 'service');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{order.customer?.fullName} — {order.vehicle?.licensePlate}</span>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="tld-pending-card__vehicle">{order.vehicle?.vehicleModel}</div>
          <div className="tld-pending-card__vehicle">
            Khoang {order.bayNumber || '—'} · Nhận: {order.createdAtTime || '—'} · Hoàn thành: {order.completedAtTime || '—'}
          </div>
          {order.technicians?.length > 0 && (
            <div className="tld-bay-status-card__tech" style={{ marginTop: 8 }}>
              Thợ thực hiện: <b>{order.technicians.map((t) => (t.sameTeam ? t.fullName : `${t.fullName} (Điều động)`)).join(', ')}</b>
            </div>
          )}

          {serviceTasks.length > 0 && (
            <div className="tld-bay-status-card__tasks" style={{ marginTop: 12 }}>
              {groupServiceTasks(serviceTasks).map((group) => (
                <div key={group.name} className="tld-task-group">
                  <div className="tld-task-group__title">{group.name}</div>
                  {group.tasks.map((task) => (
                    <label key={task.id} className={`tld-task ${task.isCancelled ? 'tld-task--cancelled' : 'tld-task--done'}`}>
                      <input type="checkbox" checked={task.isDone} readOnly disabled />
                      <div className="tld-task__body">
                        <div className="tld-task__nameRow"><TaskNameLabel t={task} /></div>
                        <TaskMeta t={task} />
                      </div>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}

          {partTasks.length > 0 && (
            <>
              <div className="form-section-title" style={{ marginTop: 16 }}>Phụ tùng đã dùng</div>
              <div className="tld-bay-status-card__tasks">
                {partTasks.map((task) => (
                  <div key={task.id} className={`tld-task ${task.isCancelled ? 'tld-task--cancelled' : ''}`}>
                    <TaskNameLabel t={task} />
                    {qtyLabel(task) && <span> {qtyLabel(task)}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ orders }) {
  const [selectedDate, setSelectedDate] = useState(() => formatDDMMYYYY(new Date()));
  const [selectedOrder, setSelectedOrder] = useState(null);
  const isToday = selectedDate === formatDDMMYYYY(new Date());
  const completed = orders.filter((o) => o.status === 'completed');
  const filtered = completed.filter((o) => o.completedAt === selectedDate);

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
            <div key={o.id} className="tld-history-row" style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(o)}>
              <div>
                <div className="tld-pending-card__customer">{o.customer?.fullName} — {o.vehicle?.licensePlate}</div>
                <div className="tld-pending-card__vehicle">Khoang {o.bayNumber || '—'} · {o.vehicle?.vehicleModel}</div>
                <div className="tld-pending-card__vehicle">Nhận: {o.createdAtTime || '—'} · Hoàn thành: {o.completedAtTime || '—'}</div>
              </div>
              <div className="tld-history-row__date">{o.completedAt}</div>
            </div>
          ))}
        </div>
      )}

      {selectedOrder && <HistoryDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
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
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [reopeningTaskId, setReopeningTaskId] = useState(null);
  const [forwardingTaskId, setForwardingTaskId] = useState(null);
  const confirm = useConfirm();
  const [claimedElsewhere, setClaimedElsewhere] = useState({});
  // So do goc tab - dem viec "chua xem": pendingSeenCount la mo (baseline) so
  // luong pending tai lan cuoi mo tab "Viec cho nhan" (null = chua seed lan
  // dau, tranh hien badge ngay khi vua vao trang du chua co gi moi that su);
  // baysUpdateCount dem so lan co thay doi (claim/tick/huy/hoan thanh) trong
  // luc KHONG dang mo tab "Khoang xe cua toi".
  const [pendingSeenCount, setPendingSeenCount] = useState(null);
  const [baysUpdateCount, setBaysUpdateCount] = useState(0);
  const activeTabRef = useRef('pending');
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const loadPending = useCallback(() => {
    listRepairSettlementsApi({ status: 'waiting_repair', scope: 'branch', limit: 200 })
      .then((result) => {
        const items = result.items || [];
        setPending(items);
        // Seed lan dau, hoac dong bo lai ngay neu dang MO SAN tab nay (khong
        // hien badge cho thu ma to truong dang nhin thay ngay truoc mat).
        setPendingSeenCount((prev) => (prev === null || activeTabRef.current === 'pending' ? items.length : prev));
      })
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
      setPending((prev) => (prev ? prev.filter((s) => s.id !== event.orderId) : prev));
    }
    if (event.type === 'claimed') {
      // Doi dong tuong ung thanh "Khoang X da nhan" (ke ca khi chinh minh vua
      // nhan) roi tu bien mat sau 10s, khong xoa ngay de kip doc.
      setClaimedElsewhere((prev) => ({ ...prev, [event.orderId]: event.bayNumber }));
      setTimeout(() => {
        setPending((prev) => (prev ? prev.filter((s) => s.id !== event.orderId) : prev));
        setClaimedElsewhere((prev) => {
          const next = { ...prev };
          delete next[event.orderId];
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
    // BAY_REFRESH_EVENT_TYPES la tap con cua ORDER_REFRESH_EVENT_TYPES nen
    // chi can kiem tra 1 lan - tranh dem trung khi 1 event khop ca 2 tap.
    if (ORDER_REFRESH_EVENT_TYPES.has(event.type) && activeTabRef.current !== 'bays') {
      setBaysUpdateCount((c) => c + 1);
    }
  }, [loadPending, loadBays, loadOrders]);

  useRepairOrderEventsSSE(handleEvent, true);

  // Go tich 1 dau muc da hoan thanh = yeu cau khoang lam lai dau muc do.
  // Neu lenh dang cho xac nhan thi tu quay ve "dang lam" (BE thu hoi moc bao
  // xong, xem RepairOrderRepositoryImpl.reopenTask).
  const handleReopenTask = async (order, task) => {
    const ok = await confirm({
      title: 'Yêu cầu làm lại đầu mục',
      message: 'Cần làm lại đầu mục công việc này?',
      detail: task.taskName,
      confirmText: 'Yêu cầu làm lại',
      tone: 'warning',
    });
    if (!ok) return;
    setReopeningTaskId(task.id);
    setError('');
    try {
      await reopenRepairOrderTaskApi(order.id, task.id);
      loadOrders();
      loadBays();
    } catch (err) {
      setError(err.message || 'Không yêu cầu làm lại đầu mục được');
    } finally {
      setReopeningTaskId(null);
    }
  };

  // Chuyen 1 dau muc "Khong dat" len co van dich vu. Khoang xe khong noi
  // thang duoc voi co van: tho cham Khong dat xong thi dau muc dung lai o day,
  // to truong ra xem tan noi roi moi bam nut nay - co van chi bat dau goi
  // khach khi da co xac nhan ky thuat cua to truong.
  const handleForwardNg = async (order, task) => {
    const ok = await confirm({
      title: 'Báo cố vấn dịch vụ',
      message: `Chuyển đầu mục "${task.taskName}" cho cố vấn dịch vụ liên hệ khách hàng?`,
      detail: task.checkNote ? `Thợ ghi: ${task.checkNote}` : undefined,
      confirmText: 'Báo cố vấn',
      tone: 'warning',
    });
    if (!ok) return;
    setForwardingTaskId(task.id);
    setError('');
    try {
      await forwardNgTaskApi(order.id, task.id);
      loadOrders();
      loadBays();
    } catch (err) {
      setError(err.message || 'Không báo cố vấn dịch vụ được');
    } finally {
      setForwardingTaskId(null);
    }
  };

  // To truong xac nhan lenh da xong sau khi khoang bao xong viec - day moi la
  // buoc lam phieu quyet toan ben CVDV chuyen "Chờ thanh toán" va giai phong
  // khoang, nen phai nap lai ca bays lan orders.
  const handleConfirmComplete = async (order) => {
    setConfirmingId(order.id);
    setError('');
    try {
      await confirmRepairOrderCompleteApi(order.id);
      loadBays();
      loadOrders();
    } catch (err) {
      setError(err.message || 'Không xác nhận hoàn thành được');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleClaimDone = () => {
    setClaimingSettlement(null);
    loadPending();
    loadBays();
    loadOrders();
  };

  const activeTabLabel = TABS.find((t) => t.key === activeTab)?.label;
  const pendingBadge = pending && pendingSeenCount !== null ? Math.max(0, pending.length - pendingSeenCount) : 0;
  const tabBadge = { pending: pendingBadge, bays: baysUpdateCount };

  const handleTabClick = (key) => {
    setActiveTab(key);
    if (key === 'pending') setPendingSeenCount(pending?.length ?? 0);
    if (key === 'bays') setBaysUpdateCount(0);
  };

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
            onClick={() => handleTabClick(t.key)}
          >
            {t.label}
            {tabBadge[t.key] > 0 && <span className="tld-tab-badge">{tabBadge[t.key] > 9 ? '9+' : tabBadge[t.key]}</span>}
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
                  {s.advisor && <div className="tld-pending-card__advisor">Cố vấn: <b>{s.advisor}</b></div>}
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

      {activeTab === 'bays' && <BayStatusGrid bays={bays} orders={orders} onAssignTechnicians={setAssigningOrder} onConfirmComplete={handleConfirmComplete} confirmingId={confirmingId} onReopenTask={handleReopenTask} reopeningTaskId={reopeningTaskId} onForwardNg={handleForwardNg} forwardingTaskId={forwardingTaskId} />}

      {activeTab === 'history' && <HistoryPanel orders={orders} />}

      {claimingSettlement && (
        <ClaimModal
          settlement={claimingSettlement}
          bays={bays}
          onClose={() => setClaimingSettlement(null)}
          onDone={handleClaimDone}
        />
      )}

      {assigningOrder && (
        <AssignTechniciansModal
          order={assigningOrder}
          onClose={() => setAssigningOrder(null)}
          onDone={() => { setAssigningOrder(null); loadOrders(); loadBays(); }}
        />
      )}
    </div>
  );
}
