"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import Reveal from "./Reveal";
import { API_BASE_URL } from "../config";
import styles from "./ServicePackages.module.css";

const BODY_FILTERS = [
  { key: "sedan", label: "Sedan", segments: ["Sedan/Hatchback"] },
  { key: "suv", label: "SUV", segments: ["SUV/Crossover"] },
  { key: "pickup", label: "Bán tải", segments: ["Pickup Truck"] },
];

function formatPrice(value) {
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

/** Tach moc bao duong tu ten goi DB (vd. "... 1.000km dau - Mazda2 ..."). */
function parseLevel(name) {
  const raw = String(name || "");
  if (/1\.000\s*km\s*đầu/i.test(raw)) {
    return { key: "km1000", label: "Gói bảo dưỡng 1.000km đầu", order: 0 };
  }
  const cap = raw.match(/Cấp\s*(\d+)/i);
  if (cap) {
    const n = Number(cap[1]);
    return { key: `cap${n}`, label: `Gói bảo dưỡng Cấp ${n}`, order: n };
  }
  // Fallback: bo phan ten xe sau dau "-".
  const generic = raw.replace(/\s*-\s*.+$/, "").trim() || raw;
  return { key: generic.toLowerCase(), label: generic, order: 99 };
}

/** Bo ten mau xe cu the trong mo ta (Mazda2, BT-50, ...). */
function cleanDescription(desc) {
  if (!desc) return "";
  return String(desc)
    .replace(/\s*dành cho\s+[^.]+?(?=\s*\(|\s*\.|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

/**
 * Trong 1 loai xe (Sedan/SUV/Ban tai): gop cac goi trung moc bao duong
 * (Luxury/Premium + nhieu dong xe) thanh 1 dong, khong ghi ten xe.
 */
function summarizeByLevel(packages, bodyKey) {
  const filter = BODY_FILTERS.find((f) => f.key === bodyKey);
  if (!filter) return [];
  const matched = packages.filter((p) => filter.segments.includes(p.segment));
  const byLevel = new Map();
  matched.forEach((p) => {
    const level = parseLevel(p.name);
    if (byLevel.has(level.key)) return;
    byLevel.set(level.key, {
      code: p.code,
      name: level.label,
      description: cleanDescription(p.description),
      totalPrice: p.totalPrice,
      order: level.order,
    });
  });
  return [...byLevel.values()].sort((a, b) => a.order - b.order);
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

export default function ServicePackages() {
  const [packages, setPackages] = useState([]);
  const [bodyType, setBodyType] = useState("sedan");

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/service-packages`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success) return;
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

  const visible = useMemo(
    () => summarizeByLevel(packages, bodyType),
    [packages, bodyType]
  );

  if (packages.length === 0) return null;

  return (
    <section id="service-packages" className={`snap-section ${styles.section}`}>
      <div className="container">
        <Reveal className={styles.heading}>
          <span className={styles.eyebrow}>Gói dịch vụ</span>
          <h2>Bảng giá gói bảo dưỡng phổ biến</h2>
        </Reveal>

        <Reveal className={styles.filters}>
          {BODY_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.filterBtn} ${bodyType === f.key ? styles.filterBtnActive : ""}`}
              onClick={() => setBodyType(f.key)}
              aria-pressed={bodyType === f.key}
            >
              {f.label}
            </button>
          ))}
        </Reveal>

        <Reveal className={`${styles.group} ${styles.featured}`}>
          <div className={styles.groupHeader}>
            <div className={styles.groupIconWrap}>
              <Wrench className={styles.groupIcon} />
            </div>
            <h3>Bảo dưỡng định kỳ</h3>
          </div>
          {visible.length === 0 ? (
            <p className={styles.empty}>Chưa có gói bảo dưỡng cho loại xe này.</p>
          ) : (
            <div className={styles.featuredList}>
              {visible.map((p) => (
                <PackageRow key={`${bodyType}-${p.name}`} p={p} />
              ))}
            </div>
          )}
        </Reveal>

        <Reveal delay={0.2} className={styles.cta}>
          <Link href="/#gui-yeu-cau" className={styles.ctaBtn}>
            Liên hệ đặt lịch
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
