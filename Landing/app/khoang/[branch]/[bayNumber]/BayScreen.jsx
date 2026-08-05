"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config";
import { apiFetch } from "../../apiClient";
import { BRANCH_SLUGS } from "../../branchSlugs";
import styles from "../../kiosk.module.css";

const POLL_INTERVAL_MS = 15000;

function ActiveJobPanel({ order, onTaskDone, onComplete, busyTaskId, completing }) {
  const tasks = order.tasks || [];
  const serviceTasks = tasks.filter((t) => t.taskType === "service");
  const partTasks = tasks.filter((t) => t.taskType !== "service");
  const doneCount = serviceTasks.filter((t) => t.isDone).length;
  const allDone = serviceTasks.length > 0 && doneCount === serviceTasks.length;

  return (
    <div className={styles.job}>
      <div className={styles.jobHeader}>
        <div>
          <div className={styles.jobCode}>{order.code}</div>
          <div className={styles.jobCustomer}>{order.customer?.fullName}</div>
          <div className={styles.jobVehicle}>{order.vehicle?.licensePlate} · {order.vehicle?.vehicleModel}</div>
          {order.technicians?.length > 0 && (
            <div className={styles.jobTechnician}>
              Thợ thực hiện: <b>{order.technicians.map((t) => (t.sameTeam ? t.fullName : `${t.fullName} (Tổ khác - điều động)`)).join(", ")}</b>
            </div>
          )}
        </div>
      </div>

      {order.notes && <div className={styles.jobNotes}>{order.notes}</div>}

      <div className={styles.jobSectionTitle}>Đầu mục công việc ({doneCount}/{serviceTasks.length})</div>
      <div className={styles.jobTasklist}>
        {serviceTasks.map((task) => (
          <label key={task.id} className={`${styles.task} ${task.isDone ? styles.taskDone : ""}`}>
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
          <div className={styles.jobSectionTitle}>Phụ tùng cần dùng</div>
          <div className={styles.jobPartlist}>
            {partTasks.map((task) => (
              <div key={task.id} className={styles.partRow}>
                <span>{task.taskName}</span>
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
    }
  }, [bay?.id, bay?.activeRepairOrderId, refreshBay]);

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
