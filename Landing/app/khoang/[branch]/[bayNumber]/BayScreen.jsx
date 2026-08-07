"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config";
import { apiFetch } from "../../apiClient";
import { BRANCH_SLUGS } from "../../branchSlugs";
import styles from "../../kiosk.module.css";

const POLL_INTERVAL_MS = 15000;

// Bao hieu am thanh khi CVDV vua sua phieu quyet toan giua chung (khach them/
// huy hang muc) - thong bao cho tho dang cui lam viec, khong can nhin man
// hinh moi biet. Dung Web Audio API tu tao 3 tieng "bip" lien tiep (song
// vuong, gion tai hon sine), am to ro rang - khong can file am thanh rieng.
// Best-effort - trinh duyet co the chan am thanh tu dong neu trang chua co
// tuong tac nao cua nguoi dung tu truoc, bo qua loi im lang.
function playUpdateChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (startAt) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.6, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.2);
    };
    const now = ctx.currentTime;
    beep(now);
    beep(now + 0.28);
    beep(now + 0.56);
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* bo qua - vd trinh duyet chan autoplay am thanh */
  }
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
    ? " (Khách hủy)"
    : qtyReturned > 0
      ? ` (Khách trả lại SL x${qtyReturned})`
      : t.isQtyIncreased
        ? ` (Khách thêm số lượng, tổng là: ${t.quantity})`
        : t.isAddedLater
          ? " (Khách thêm)"
          : "";
  return (
    <>
      <span style={{ textDecoration: isStruckThrough(t) ? "line-through" : "none" }}>{t.taskName}</span>
      {suffix && <span style={{ textDecoration: "none" }}>{suffix}</span>}
    </>
  );
}

function ActiveJobPanel({ order, onTaskDone, onComplete, busyTaskId, completing }) {
  const tasks = order.tasks || [];
  const serviceTasks = tasks.filter((t) => t.taskType === "service");
  const partTasks = tasks.filter((t) => t.taskType !== "service");
  const activeServiceTasks = serviceTasks.filter((t) => !t.isCancelled);
  const doneCount = activeServiceTasks.filter((t) => t.isDone).length;
  const allDone = activeServiceTasks.length > 0 && doneCount === activeServiceTasks.length;

  return (
    <div className={styles.job}>
      <div className={styles.jobHeader}>
        <div>
          <div className={styles.jobCustomer}>Khách hàng: <b>{order.customer?.fullName}</b></div>
          <div className={styles.jobVehicle}>{order.vehicle?.licensePlate} · {order.vehicle?.vehicleModel}</div>
          {order.technicians?.length > 0 && (
            <div className={styles.jobTechnician}>
              Thợ thực hiện: <b>{order.technicians.map((t) => (t.sameTeam ? t.fullName : `${t.fullName} (Tổ khác - điều động)`)).join(", ")}</b>
            </div>
          )}
        </div>
      </div>

      {order.notes && <div className={styles.jobNotes}>{order.notes}</div>}

      <div className={styles.jobSectionTitle}>Đầu mục công việc ({doneCount}/{activeServiceTasks.length})</div>
      <div className={styles.jobTasklist}>
        {serviceTasks.map((task) => (
          <label
            key={task.id}
            className={`${styles.task} ${isStruckThrough(task) ? styles.taskCancelled : (task.isDone ? styles.taskDone : "")}`}
          >
            <input
              type="checkbox"
              checked={task.isDone}
              disabled={busyTaskId === task.id || task.isDone || task.isCancelled}
              onChange={() => onTaskDone(task)}
            />
            <div className={styles.taskBody}>
              <div className={styles.taskNameRow}>
                <TaskNameLabel t={task} />
                {task.quantity > 1 && <span className={styles.partRowQty}>x{task.quantity}</span>}
              </div>
              {task.note && <div className={styles.taskNote}>{task.note}</div>}
            </div>
          </label>
        ))}
      </div>

      {partTasks.length > 0 && (
        <>
          <div className={styles.jobSectionTitle}>Phụ tùng cần dùng</div>
          <div className={styles.jobPartlist}>
            {partTasks.map((task) => (
              <div key={task.id} className={`${styles.partRow} ${isStruckThrough(task) ? styles.taskCancelled : ""}`}>
                <div className={styles.taskBody}>
                  <div className={styles.taskNameRow}>
                    <TaskNameLabel t={task} />
                  </div>
                  {task.note && <div className={styles.taskNote}>{task.note}</div>}
                </div>
                {task.quantity > 1 && <span className={styles.partRowQty}>x{task.quantity}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary} ${styles.jobComplete}`}
        disabled={!allDone || completing}
        onClick={onComplete}
      >
        {completing ? "Đang xử lý…" : "Hoàn thành"}
      </button>
    </div>
  );
}

// Man lam viec cong khai (khong dang nhap) tai dung 1 khoang vat ly. "Nhan
// viec" (chon phieu + gan khoang + gan tho) va "Lich su" da chuyen ve tai
// khoan cua chinh to truong (dang nhap binh thuong tren CRM, xem
// TeamLeaderDashboard.jsx) - man nay chi con nhan viec DA duoc gan san roi
// tick dau muc/Hoan thanh.
export default function BayScreen({ slug, bayNumber }) {
  const code = BRANCH_SLUGS[slug];

  const [branch, setBranch] = useState(undefined); // undefined=dang tim, null=khong co
  const [bay, setBay] = useState(undefined);
  const [activeOrder, setActiveOrder] = useState(null);
  const [error, setError] = useState("");
  const [cancelledInfo, setCancelledInfo] = useState("");
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [completing, setCompleting] = useState(false);

  // Buoc 1: slug -> chi nhanh (branchId).
  useEffect(() => {
    if (!code) { setBranch(null); return; }
    apiFetch("/public/branches")
      .then((data) => {
        const found = (data || []).find((b) => b.code === code);
        setBranch(found || null);
      })
      .catch(() => setBranch(null));
  }, [code]);

  // Buoc 2: chi nhanh + so khoang -> dung khoang (id, teamLeaderId,...).
  const refreshBay = useCallback(() => {
    if (!branch?.id) return;
    apiFetch(`/public/bays?branchId=${branch.id}`)
      .then((data) => {
        const found = (data || []).find((b) => String(b.bayNumber) === String(bayNumber));
        setBay(found || null);
      })
      .catch((err) => setError(err.message || "Không tải được thông tin khoang"));
  }, [branch?.id, bayNumber]);

  useEffect(() => {
    if (branch?.id) refreshBay();
    if (branch === null) setBay(null);
  }, [branch, refreshBay]);

  const loadActiveOrder = useCallback(() => {
    if (!bay?.activeRepairOrderId) { setActiveOrder(null); return; }
    apiFetch(`/public/bays/${bay.id}/active-order`)
      .then(setActiveOrder)
      .catch((err) => setError(err.message || "Không tải được việc đang làm"));
  }, [bay?.id, bay?.activeRepairOrderId]);

  useEffect(() => {
    if (!bay) return;
    setCancelledInfo("");
    loadActiveOrder();
  }, [bay, loadActiveOrder]);

  const handleEvent = useCallback((event) => {
    if (event.type === "order-cancelled" && event.orderId && event.orderId === bay?.activeRepairOrderId) {
      // Dung lenh khoang nay dang hien - bao ngay, khong doi den luc to
      // truong bam gi do that bai moi biet.
      setCancelledInfo(`Phiếu đã bị hủy. Lý do: ${event.cancelReason || "Không rõ lý do"}`);
      return;
    }
    if (event.type === "claimed" && event.bayId === bay?.id) {
      // To truong vua nhan + gan xong cho dung khoang nay tu tai khoan cua
      // ho - nap lai bay de chuyen sang man viec dang lam.
      refreshBay();
      return;
    }
    if (event.type === "task-updated" && event.orderId === bay?.activeRepairOrderId) {
      // Checklist cua dung lenh dang hien vua doi - co the do to truong/tho
      // tu tick (event.taskId co gia tri) hoac do CVDV sua phieu giua chung
      // (event.taskId = null, xem RepairSettlementService.update) - vd khach
      // them/huy hang muc. Chi phat am bao cho truong hop CVDV sua phieu -
      // tho dang tu tick tren chinh man hinh nay thi khong can bao lai chinh ho.
      if (event.taskId == null) {
        playUpdateChime();
      }
      loadActiveOrder();
    }
  }, [bay?.id, bay?.activeRepairOrderId, refreshBay, loadActiveOrder]);

  // Realtime - kenh public rieng cho man khoang xe, xem sseRoutes.js
  // /sse/bay-board. Kem poll 15s lam luoi an toan phong khi mat ket noi SSE
  // tam thoi (cung pattern voi BranchGateScreen.jsx - man bao ve).
  useEffect(() => {
    if (!bay?.branchId) return undefined;

    const intervalId = setInterval(refreshBay, POLL_INTERVAL_MS);

    let es;
    try {
      es = new EventSource(`${API_BASE_URL}/sse/bay-board?branchId=${bay.branchId}`);
      es.addEventListener("bay-board", (e) => {
        try { handleEvent(JSON.parse(e.data)); } catch { /* ignore */ }
      });
    } catch {
      /* SSE khong kha dung thi van con poll */
    }

    return () => {
      clearInterval(intervalId);
      es?.close();
    };
  }, [bay?.branchId, handleEvent, refreshBay]);

  const handleTaskDone = async (task) => {
    setBusyTaskId(task.id);
    try {
      const updated = await apiFetch(`/public/repair-orders/${activeOrder.id}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ bayId: bay.id, isDone: true }),
      });
      setActiveOrder(updated);
    } catch (err) {
      if (err.code === "ORDER_CANCELLED") {
        setCancelledInfo(err.message);
      } else {
        setError(err.message || "Không cập nhật được đầu mục công việc");
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError("");
    try {
      await apiFetch(`/public/repair-orders/${activeOrder.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ bayId: bay.id, status: "completed" }),
      });
      refreshBay();
    } catch (err) {
      if (err.code === "ORDER_CANCELLED") {
        setCancelledInfo(err.message);
      } else {
        setError(err.message || "Không đánh dấu hoàn thành được");
      }
    } finally {
      setCompleting(false);
    }
  };

  if (branch === undefined || bay === undefined) {
    return <div className={styles.center}><div className={styles.empty}>Đang tải…</div></div>;
  }

  if (!branch || !bay) {
    return (
      <div className={styles.center}>
        <div className={styles.empty}>Không tìm thấy khoang xe này</div>
      </div>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.leaderName}>Tổ trưởng: {bay.teamLeaderName}</div>
      <div className={styles.boardTopbar}>
        <div className={styles.boardBayLabel}>Khoang {bay.bayNumber}</div>
      </div>

      {cancelledInfo ? (
        <div className={`${styles.error} ${styles.errorCancelled}`}>
          <span>{cancelledInfo}</span>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={refreshBay}>
            Về màn hình chờ việc
          </button>
        </div>
      ) : (
        error && <div className={styles.error}>{error}</div>
      )}

      {bay.activeRepairOrderId ? (
        !activeOrder
          ? <div className={styles.empty}>Đang tải…</div>
          : <ActiveJobPanel order={activeOrder} onTaskDone={handleTaskDone} onComplete={handleComplete} busyTaskId={busyTaskId} completing={completing} />
      ) : (
        <div className={styles.empty}>Chưa có việc được gán cho khoang này.</div>
      )}
    </div>
  );
}
