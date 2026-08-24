"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../config";
import formStyles from "./LookupForm.module.css";
import styles from "./VehicleHistoryLookupForm.module.css";

export default function VehicleHistoryLookupForm() {
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error | success
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMessage("");
    setResult(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/public/vehicle-history/${encodeURIComponent(trimmed)}`
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        setStatus("error");
        setErrorMessage(body?.message || "Không thể tra cứu lúc này. Vui lòng thử lại.");
        return;
      }

      if (!body.data) {
        setStatus("error");
        setErrorMessage(
          "Không tìm thấy lịch sử bảo dưỡng cho biển số / số khung này. Vui lòng kiểm tra lại."
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

  return (
    <div>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <input
          className={formStyles.input}
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Nhập biển số xe hoặc số khung"
          autoComplete="off"
        />
        <button className={formStyles.submit} type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Đang tra cứu..." : "Tra cứu"}
        </button>
      </form>
      <p className={styles.hint}>Xe đã đổi biển số? Nhập số khung để tra cứu vẫn được.</p>

      <AnimatePresence mode="wait">
        {status === "error" && (
          <motion.p
            key="error"
            className={formStyles.error}
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
            className={formStyles.result}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className={styles.vehicleHead}>
              <span className={styles.plate}>{result.vehicle.licensePlate}</span>
              {result.vehicle.vehicleModel && (
                <span className={styles.model}>{result.vehicle.vehicleModel}</span>
              )}
            </div>

            <ul className={styles.historyList}>
              {result.history.map((h) => (
                <li key={h.code} className={styles.historyItem}>
                  <div className={styles.historyRow}>
                    <span className={styles.historyCode}>{h.code}</span>
                    <span className={styles.historyBadge}>{h.statusLabel}</span>
                  </div>
                  <div className={styles.historyMeta}>
                    <span>{h.branchName}</span>
                    <span>Tiếp nhận: {h.intakeDate}</span>
                    {h.completedDate && <span>Hoàn thành: {h.completedDate}</span>}
                  </div>
                  {h.maintenanceItems && (
                    <div className={styles.historyPackage}>Gói bảo dưỡng: {h.maintenanceItems}</div>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
