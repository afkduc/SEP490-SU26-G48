"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../config";
import { BRANCH_SLUGS } from "./branchSlugs";
import styles from "./GateScreen.module.css";

const SLUG_BY_CODE = Object.fromEntries(
  Object.entries(BRANCH_SLUGS).map(([slug, code]) => [code, slug])
);

export default function BranchChooser() {
  const [branches, setBranches] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/branches`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) throw new Error(body?.message || "Không tải được danh sách chi nhánh");
        setBranches(body.data || []);
      })
      .catch((err) => setError(err.message || "Không thể kết nối tới máy chủ"));
  }, []);

  const linkable = branches?.filter((b) => SLUG_BY_CODE[b.code]) || [];

  return (
    <div className={styles.pickerWrap}>
      <h1 className={styles.pickerTitle}>Màn hình bảo vệ — chọn chi nhánh</h1>
      <p className={styles.pickerDesc}>
        Chỉ cần mở đúng 1 lần rồi bookmark lại đường dẫn chi nhánh của bạn cho các lần sau.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      {!branches && !error && <p className={styles.muted}>Đang tải…</p>}
      <div className={styles.pickerGrid}>
        {linkable.map((b) => (
          <Link key={b.id} href={`/security/${SLUG_BY_CODE[b.code]}`} className={styles.pickerCard}>
            {b.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
