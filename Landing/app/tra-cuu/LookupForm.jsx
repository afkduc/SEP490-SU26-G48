"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../config";
import styles from "./LookupForm.module.css";

const STATUS_LABELS = {
  pending_assignment: { label: "Đang chờ sửa chữa", tone: "pending" },
  inprogress: { label: "Đang sửa chữa", tone: "progress" },
  completed: { label: "Đã hoàn thành", tone: "done" },
  cancelled: { label: "Đã huỷ", tone: "cancelled" },
};

export default function LookupForm() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error | success
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMessage("");
    setResult(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/public/lookup/${encodeURIComponent(trimmed)}`
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        setStatus("error");
        setErrorMessage(
          body?.message || "Không tìm thấy mã sửa chữa này. Vui lòng kiểm tra lại."
        );
        return;
      }

      setResult(body.data);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Không thể kết nối tới máy chủ. Vui lòng thử lại sau.");
    }
  }

  // "Dang cho sua chua" / "Hoan thanh" chi la 2 moc dau/cuoi de minh hoa ca
  // hanh trinh - khong tinh vao % tien do, chi tinh tren hang muc that su.
  const realTasks = result?.tasks?.filter((t) => !t.isMilestone) ?? [];
  const doneCount = realTasks.filter((t) => t.isDone).length;
  const totalCount = realTasks.length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const statusInfo = result ? STATUS_LABELS[result.status] ?? { label: result.status, tone: "progress" } : null;

  return (
    <div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Nhập mã sửa chữa (VD: RO-2026-012)"
          autoComplete="off"
        />
        <button className={styles.submit} type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Đang tra cứu..." : "Tra cứu"}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {status === "error" && (
          <motion.p
            key="error"
            className={styles.error}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {errorMessage}
          </motion.p>
        )}

        {status === "success" && result && (
          <motion.div
            key="result"
            className={styles.result}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className={styles.resultHead}>
              <span className={styles.resultCode}>{result.code}</span>
              <span className={`${styles.badge} ${styles[statusInfo.tone]}`}>
                {statusInfo.label}
              </span>
            </div>

            {result.branchName && (
              <p className={styles.branch}>Chi nhánh: {result.branchName}</p>
            )}

            {totalCount > 0 && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <motion.div
                    className={styles.progressFill}
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <span className={styles.progressLabel}>
                  {doneCount}/{totalCount} hạng mục hoàn thành ({percent}%)
                </span>
              </div>
            )}

            {totalCount > 0 && (
              <ul className={styles.taskList}>
                {result.tasks.map((t, i) => (
                  <li key={i} className={t.isDone ? styles.taskDone : styles.taskPending}>
                    <span className={styles.taskDot} />
                    {t.taskName}
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.dates}>
              {result.createdAt && <span>Tiếp nhận: {result.createdAt}</span>}
              {result.completedAt && <span>Hoàn thành: {result.completedAt}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
