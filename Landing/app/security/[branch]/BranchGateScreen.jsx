"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../config";
import { BRANCH_SLUGS } from "../branchSlugs";
import styles from "../GateScreen.module.css";

const POLL_INTERVAL_MS = 15000;

export default function BranchGateScreen({ slug }) {
  const code = BRANCH_SLUGS[slug];

  const [branch, setBranch] = useState(undefined); // undefined = dang tim, null = khong co
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Slug trong URL -> branch_code -> tim dung branch{id,name} tu danh sach
  // chi nhanh public. Lam 1 lan luc vao trang, khong can dang nhap.
  useEffect(() => {
    if (!code) {
      setBranch(null);
      return;
    }
    fetch(`${API_BASE_URL}/public/branches`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) throw new Error(body?.message || "Không tải được chi nhánh");
        const found = (body.data || []).find((b) => b.code === code);
        setBranch(found || null);
      })
      .catch(() => setBranch(null));
  }, [code]);

  const load = useCallback((branchId) => {
    return fetch(`${API_BASE_URL}/public/gate/pending?branchId=${branchId}`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) throw new Error(body?.message || "Không tải được danh sách");
        setPending(body.data || []);
        setLastUpdated(new Date());
        setError("");
      })
      .catch((err) => setError(err.message || "Không thể kết nối tới máy chủ"));
  }, []);

  // SSE bao realtime khi co xe moi xuat hoa don hoac vua duoc xac nhan ra
  // cong (o man hinh khac neu co nhieu cong/nhieu bao ve) - kem poll 15s lam
  // luoi an toan phong khi mat ket noi SSE tam thoi.
  useEffect(() => {
    if (!branch?.id) return undefined;

    load(branch.id);
    const intervalId = setInterval(() => load(branch.id), POLL_INTERVAL_MS);

    let es;
    try {
      es = new EventSource(`${API_BASE_URL}/sse/gate?branchId=${branch.id}`);
      es.addEventListener("gate", () => load(branch.id));
    } catch {
      /* SSE khong kha dung thi van con poll */
    }

    return () => {
      clearInterval(intervalId);
      es?.close();
    };
  }, [branch, load]);

  const handleConfirm = async (id) => {
    setConfirmingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/public/gate/${id}/confirm-exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branch.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || "Xác nhận thất bại, vui lòng thử lại");
      }
      setPending((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch (err) {
      setError(err.message || "Xác nhận thất bại, vui lòng thử lại");
    } finally {
      setConfirmingId(null);
    }
  };

  if (branch === undefined) {
    return <div className={styles.centerFill}><p className={styles.muted}>Đang tải…</p></div>;
  }

  if (!branch) {
    return (
      <div className={styles.centerFill}>
        <div style={{ textAlign: "center" }}>
          <p className={styles.emptyText}>Không tìm thấy chi nhánh này</p>
          <Link href="/security" style={{ color: "var(--accent)", fontWeight: 600 }}>
            ← Chọn lại chi nhánh
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>AutoGara — Màn hình bảo vệ</div>
          <h1 className={styles.branchName}>{branch.name}</h1>
        </div>
        {lastUpdated && (
          <span className={styles.updatedAt}>
            Cập nhật lúc {lastUpdated.toLocaleTimeString("vi-VN")}
          </span>
        )}
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {pending === null && !error && (
        <div className={styles.centerFill}><p className={styles.muted}>Đang tải…</p></div>
      )}

      {pending?.length === 0 && (
        <div className={styles.centerFill}>
          <p className={styles.emptyText}>Chưa có xe nào chuẩn bị ra cổng</p>
        </div>
      )}

      {pending?.length > 0 && (
        <div className={styles.grid}>
          {pending.map((p) => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardCode}>{p.code}</div>
              <div className={styles.plate}>{p.vehiclePlate}</div>
              <div className={styles.vehicleModel}>{p.vehicleModel}</div>
              <div className={styles.customerName}>{p.customerName}</div>
              <button
                className={styles.confirmBtn}
                disabled={confirmingId === p.id}
                onClick={() => handleConfirm(p.id)}
              >
                {confirmingId === p.id ? "Đang xử lý…" : "✓ Đúng xe — Mở cổng"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
