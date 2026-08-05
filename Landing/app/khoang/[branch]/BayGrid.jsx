"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../config";
import { BRANCH_SLUGS } from "../branchSlugs";
import styles from "../kiosk.module.css";

export default function BayGrid({ slug }) {
  const code = BRANCH_SLUGS[slug];

  const [branch, setBranch] = useState(undefined); // undefined = dang tim, null = khong co
  const [bays, setBays] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) { setBranch(null); return; }
    fetch(`${API_BASE_URL}/public/branches`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) throw new Error(body?.message || "Không tải được chi nhánh");
        const found = (body.data || []).find((b) => b.code === code);
        setBranch(found || null);
      })
      .catch(() => setBranch(null));
  }, [code]);

  const loadBays = useCallback((branchId) => {
    return fetch(`${API_BASE_URL}/public/bays?branchId=${branchId}`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) throw new Error(body?.message || "Không tải được danh sách khoang");
        setBays(body.data || []);
      })
      .catch((err) => setError(err.message || "Không thể kết nối tới máy chủ"));
  }, []);

  useEffect(() => {
    if (!branch?.id) return undefined;
    loadBays(branch.id);

    let es;
    try {
      es = new EventSource(`${API_BASE_URL}/sse/bay-board?branchId=${branch.id}`);
      es.addEventListener("bay-board", () => loadBays(branch.id));
    } catch {
      /* bo qua, man se van dung duoc khi vao lai trang */
    }
    return () => es?.close();
  }, [branch, loadBays]);

  if (branch === undefined) {
    return <div className={styles.center}><p className={styles.empty}>Đang tải…</p></div>;
  }

  if (!branch) {
    return (
      <div className={styles.center}>
        <p className={styles.empty}>Không tìm thấy chi nhánh này</p>
        <Link href="/khoang" className={styles.leaderName}>← Chọn lại chi nhánh</Link>
      </div>
    );
  }

  return (
    <div className={styles.center}>
      <h1 className={styles.title}>{branch.name} — chọn khoang xe</h1>
      {error && <div className={styles.error}>{error}</div>}
      {bays === null && !error && <p className={styles.empty}>Đang tải…</p>}
      {bays?.length === 0 && <p className={styles.empty}>Chi nhánh chưa có khoang xe nào.</p>}
      {bays?.length > 0 && (
        <div className={styles.bayGrid}>
          {bays.map((b) => {
            const busy = Boolean(b.activeRepairOrderId);
            return (
              <Link
                key={b.id}
                href={`/khoang/${slug}/${b.bayNumber}`}
                className={`${styles.bayTile} ${busy ? styles.bayTileBusy : ""}`}
              >
                <span className={styles.bayTileNumber}>Khoang {b.bayNumber}</span>
                <span className={styles.bayTileStatus}>{busy ? "Đang làm việc" : "Trống"}</span>
                <span className={styles.bayTileLeader}>Tổ trưởng: {b.teamLeaderName || "—"}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
