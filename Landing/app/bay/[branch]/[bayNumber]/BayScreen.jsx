"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config";
import { apiFetch } from "../../apiClient";
import { BRANCH_SLUGS } from "../../branchSlugs";
import IntakeChecklistView from "../../IntakeChecklistView";
import { actionLabel, groupServiceTasks, needsCheckResult } from "../../maintenanceChecklist";
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

// So luong + DON VI TINH cua dau muc phu tung: "4 Lít", "1 Cái"... Tho o
// khoang phai biet do 4 LIT dau hay lay 4 CAI bugi, chi so khong thi khong du.
// Dau muc dich vu khong co DVT va luon SL 1 -> tra ve rong, khong hien gi.
function qtyLabel(t) {
  const n = Number(t.quantity) || 0;
  if (!t.unit && n <= 1) return '';
  return `${n}${t.unit ? ` ${t.unit}` : ''}`;
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

// 1 dong dau muc cong viec. Hai kieu tuong tac, theo dung bieu mau BDDK:
//  - Dau muc PHAI THAY (hoac dau muc ngoai goi bao duong): tick "da lam xong"
//    nhu cu.
//  - Dau muc KIEM TRA (kiem tra/dieu chinh, thao ve sinh do kiem, kiem tra
//    bang mat): chon Dat hoac Khong dat - dung cot KET QUA OK/NG. Chon "Khong
//    dat" thi phai mo ta noi dung truoc khi luu, dung huong dan tren bieu mau.
function TaskRow({ task, busy, onTaskDone }) {
  const [ngOpen, setNgOpen] = useState(false);
  const [ngNote, setNgNote] = useState("");
  const label = actionLabel(task.actionCode);
  const locked = busy || task.isDone || task.isCancelled;
  // Khach da dong y thay: dau muc quay lai thanh viec PHAI LAM (BE dat lai
  // is_done=0 luc co van ghi nhan). Lan tick nay la "da thay xong", khong hoi
  // Dat/Khong dat nua - da cham roi, ket qua la Khong dat.
  const dangChoThay = task.ngDecision === "accepted" && !task.isDone && !task.isCancelled;
  const wantsResult = needsCheckResult(task.actionCode) && !dangChoThay;

  const body = (
    <div className={styles.taskBody}>
      <div className={styles.taskNameRow}>
        <TaskNameLabel t={task} />
        {qtyLabel(task) && <span className={styles.partRowQty}>{qtyLabel(task)}</span>}
      </div>
      {label && <div className={styles.taskAction}>{label}</div>}
      {task.note && <div className={styles.taskNote}>{task.note}</div>}
      {task.checkResult && (
        <div className={task.checkResult === "NG" ? styles.taskResultNg : styles.taskResultOk}>
          {task.checkResult === "NG" ? "Không đạt" : "Đạt"}
          {task.checkResult === "NG" && task.checkNote ? ` — ${task.checkNote}` : ""}
        </div>
      )}
      {/* Bao "Khong dat" xong thi viec chuyen sang TO TRUONG - tho khong phai
          cho ai goi cho khach, va cung khong tu goi. Ghi ro dang o dau de tho
          khong bam lai hay di hoi lai. Xem ensureNgDecision.js. */}
      {task.checkResult === "NG" && task.ngDecision === "reported" && (
        <div className={styles.taskNgFlow}>Đã báo tổ trưởng — chờ tổ trưởng chuyển cố vấn dịch vụ</div>
      )}
      {task.checkResult === "NG" && task.ngDecision === "pending" && (
        <div className={styles.taskNgFlow}>Tổ trưởng đã báo cố vấn — chờ khách quyết định</div>
      )}
      {task.checkResult === "NG" && task.ngDecision === "accepted" && (
        <div className={styles.taskNgOk}>
          {task.isDone
            ? "Khách đồng ý thay — đã thay xong"
            : "Khách đồng ý thay — phụ tùng đã thêm vào phiếu, thay xong thì tích ô bên trái"}
        </div>
      )}
      {/* To truong xu ly luon, khong qua co van - ket qua da doi thanh Dat
          nen khong loc theo checkResult duoc nua. */}
      {task.ngDecision === "resolved" && (
        <div className={styles.taskNgOk}>
          Tổ trưởng đã xử lý tại xưởng{task.ngNote ? ` — ${task.ngNote}` : ""}
        </div>
      )}
      {task.checkResult === "NG" && task.ngDecision === "declined" && (
        <div className={styles.taskNgFlow}>
          Khách từ chối thay{task.ngNote ? ` — ${task.ngNote}` : ""}
        </div>
      )}
    </div>
  );

  if (!wantsResult) {
    return (
      <label className={`${styles.task} ${isStruckThrough(task) ? styles.taskCancelled : (task.isDone ? styles.taskDone : "")}`}>
        <input type="checkbox" checked={task.isDone} disabled={locked} onChange={() => onTaskDone(task)} />
        {body}
      </label>
    );
  }

  return (
    <div className={`${styles.task} ${styles.taskCheck} ${isStruckThrough(task) ? styles.taskCancelled : (task.isDone ? styles.taskDone : "")}`}>
      {body}
      {!task.isDone && !task.isCancelled && !ngOpen && (
        <div className={styles.taskResultBtns}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnOk}`}
            disabled={busy}
            onClick={() => onTaskDone(task, { checkResult: "OK" })}
          >
            Đạt
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnNg}`}
            disabled={busy}
            onClick={() => { setNgNote(""); setNgOpen(true); }}
          >
            Không đạt
          </button>
        </div>
      )}
      {ngOpen && (
        <div className={styles.taskNgForm}>
          <textarea
            className={styles.taskNgInput}
            rows={2}
            autoFocus
            value={ngNote}
            onChange={(e) => setNgNote(e.target.value)}
            placeholder="Mô tả nội dung không đạt (bắt buộc)…"
          />
          <div className={styles.taskResultBtns}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${styles.btnNg}`}
              disabled={busy || !ngNote.trim()}
              onClick={async () => {
                await onTaskDone(task, { checkResult: "NG", checkNote: ngNote.trim() });
                setNgOpen(false);
              }}
            >
              Lưu
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              disabled={busy}
              onClick={() => setNgOpen(false)}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveJobPanel({ order, onTaskDone, busyTaskId }) {
  const [showIntake, setShowIntake] = useState(false);
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
          {/* Ma phieu de o tren cung: tho bao viec gi len to truong/cố vấn
              cung noi theo ma nay, khong the ta "cai xe mau trang o khoang 2". */}
          {order.code && <div className={styles.jobCode}>{order.code}</div>}
          <div className={styles.jobCustomer}>Khách hàng: <b>{order.customer?.fullName}</b></div>
          <div className={styles.jobVehicle}>{order.vehicle?.licensePlate} · {order.vehicle?.vehicleModel}</div>
          {order.advisorName && (
            <div className={styles.jobTechnician}>CVDV: <b>{order.advisorName}</b></div>
          )}
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
        {groupServiceTasks(serviceTasks).map((group) => (
          <div key={group.name} className={styles.taskGroup}>
            <div className={styles.taskGroupTitle}>{group.name}</div>
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                busy={busyTaskId === task.id}
                onTaskDone={onTaskDone}
              />
            ))}
          </div>
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
                  {task.isCancelled && (
                    <div className={styles.taskReturnNote}>Số lượng trả lại kho {qtyLabel(task) || task.quantity}</div>
                  )}
                </div>
                {qtyLabel(task) && <span className={styles.partRowQty}>{qtyLabel(task)}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        className={`${styles.btn} ${styles.btnSecondary}`}
        style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
        onClick={() => setShowIntake(true)}
      >
        Xem tình trạng xe ban đầu
      </button>

      {/* Khoang xe KHONG co nut ket thuc lenh - tho chi tick tung dau muc.
          Xong het thi to truong nhin thay du dau muc va bam "Hoàn thành" tren
          tai khoan cua ho, luc do phieu quyet toan moi chuyen "Chờ thanh
          toán". Xem RepairOrderService.confirmCompleted. */}
      {allDone && (
        <div className={styles.jobAwaitingConfirm}>
          Đã xong tất cả đầu mục — chờ tổ trưởng xác nhận hoàn thành.
        </div>
      )}

      {showIntake && (
        <div className={styles.modalOverlay} onClick={() => setShowIntake(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Tiếp nhận và bàn giao xe</span>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => setShowIntake(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <IntakeChecklistView value={order.intakeChecklist} vehicleModelText={order.vehicle?.vehicleModel} />
            </div>
          </div>
        </div>
      )}
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

  // Tu an thong bao loi sau 5s (moi setError() o duoi deu qua day) - tranh
  // banner do nam lai man hinh kiosk mai khong ai bam tat.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

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
      // event.reopened = to truong vua GO TICH 1 dau muc, tra ve cho tho lam
      // lai - phai bao am giong truong hop CVDV sua phieu, vi day khong phai
      // tien do do chinh tho vua tick.
      if (event.taskId == null || event.reopened) {
        playUpdateChime();
      }
      loadActiveOrder();
      return;
    }
    if (event.type === "bay-reported" && event.orderId === bay?.activeRepairOrderId) {
      // Cung 1 khoang co the dang mo tren nhieu man - dong bo trang thai
      // "đã báo xong, chờ tổ trưởng xác nhận" cho tat ca.
      loadActiveOrder();
      return;
    }
    if (event.type === "order-completed" && event.orderId === bay?.activeRepairOrderId) {
      // To truong vua xac nhan hoan thanh -> lenh khong con 'inprogress' nen
      // khoang duoc giai phong, man hinh tra ve trang thai "Trống".
      refreshBay();
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

  const handleTaskDone = async (task, { checkResult, checkNote } = {}) => {
    setBusyTaskId(task.id);
    try {
      const updated = await apiFetch(`/public/repair-orders/${activeOrder.id}/tasks/${task.id}`, {
        method: "PATCH",
        // Dau muc kiem tra gui kem ket qua Dat/Khong dat (+ mo ta khi Khong
        // dat); dau muc phai thay chi gui isDone nhu cu. BE tu chan lai neu
        // gui thieu/thua so voi loai dau muc (xem RepairOrderService).
        body: JSON.stringify({ bayId: bay.id, isDone: true, checkResult, checkNote }),
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
          : <ActiveJobPanel order={activeOrder} onTaskDone={handleTaskDone} busyTaskId={busyTaskId} />
      ) : (
        <div className={styles.empty}>Chưa có việc được gán cho khoang này.</div>
      )}
    </div>
  );
}
