"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, ClipboardList } from "lucide-react";
import Reveal from "./Reveal";
import { API_BASE_URL } from "../config";
import styles from "./ServicePackages.module.css";

const CATEGORY_ICONS = {
  "Bảo dưỡng định kỳ": Wrench,
  "Bảo dưỡng cơ bản": Wrench,
};

function formatPrice(value) {
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

// Danh muc nhieu goi nhat (thuong la "Bao duong dinh ky") duoc tach rieng
// thanh 1 the rong full-width, cac danh muc con lai (thuong chi 1-2 goi moi
// danh muc) xep thanh 1 hang deu nhau ben duoi - tranh phai chia 2 cot cao
// bang nhau trong khi so luong goi giua cac danh muc chenh lech qua nhieu.
function splitFeatured(packages) {
  const map = new Map();
  packages.forEach((p) => {
    const key = p.categoryName || "Khác";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  const groups = Array.from(map.entries())
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => b.items.length - a.items.length);

  return { featured: groups[0], others: groups.slice(1) };
}

function PackageRow({ p }) {
  return (
    <Link href={`/service-packages/${p.code}`} className={styles.row}>
      <div className={styles.rowInfo}>
        <div className={styles.rowName}>{p.name}</div>
        <div className={styles.rowDesc}>{p.description}</div>
      </div>
      <div className={styles.rowPrice}>{formatPrice(p.totalPrice)}</div>
    </Link>
  );
}

function GroupHeader({ category }) {
  const Icon = CATEGORY_ICONS[category] || ClipboardList;
  return (
    <div className={styles.groupHeader}>
      <div className={styles.groupIconWrap}>
        <Icon className={styles.groupIcon} />
      </div>
      <h3>{category}</h3>
    </div>
  );
}

export default function ServicePackages() {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/service-packages`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) return;
        // Chi hien goi bao duong (doi phong neu API tra them goi sua chua).
        setPackages(
          body.data.filter((p) =>
            String(p.categoryName || "")
              .toLowerCase()
              .includes("bảo dưỡng")
          )
        );
      })
      .catch(() => {});
  }, []);

  if (packages.length === 0) return null;

  const { featured, others } = splitFeatured(packages);

  return (
    <section id="service-packages" className={`snap-section ${styles.section}`}>
      <div className="container">
        <Reveal className={styles.heading}>
          <span className={styles.eyebrow}>Gói dịch vụ</span>
          <h2>Bảng giá gói bảo dưỡng phổ biến</h2>
        </Reveal>

        {featured && (
          <Reveal className={`${styles.group} ${styles.featured}`}>
            <GroupHeader category={featured.category} />
            <div className={styles.featuredList}>
              {featured.items.map((p) => (
                <PackageRow key={p.code} p={p} />
              ))}
            </div>
          </Reveal>
        )}

        <div className={styles.othersRow}>
          {others.map((g, i) => (
            <Reveal key={g.category} delay={i * 0.06} className={styles.group}>
              <GroupHeader category={g.category} />
              <div className={styles.list}>
                {g.items.map((p) => (
                  <PackageRow key={p.code} p={p} />
                ))}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className={styles.cta}>
          <Link href="/#gui-yeu-cau" className={styles.ctaBtn}>
            Liên hệ đặt lịch
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
