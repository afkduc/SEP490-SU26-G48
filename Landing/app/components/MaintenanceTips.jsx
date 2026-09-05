"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  AlertTriangle,
  Disc3,
  Snowflake,
  Activity,
  Fuel,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Reveal from "./Reveal";
import { maintenanceTips } from "../data/maintenanceTips";
import styles from "./MaintenanceTips.module.css";

const ICONS = { ClipboardCheck, AlertTriangle, Disc3, Snowflake, Activity, Fuel };

const SLIDE_INTERVAL_MS = 5000;
const total = maintenanceTips.length;

// So the hien cung luc phai co gian theo man hinh - truoc day co dinh 3 the
// moi kich thuoc, tren dien thoai moi the chi con ~90px khien chu vo dong
// tung ky tu (xem anh chup thuc te tren mobile).
function getVisibleCount(width) {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return 3;
}

export default function MaintenanceTips() {
  const [visible, setVisible] = useState(3);
  const [index, setIndex] = useState(0);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    function updateVisible() {
      setVisible(getVisibleCount(window.innerWidth));
    }
    updateVisible();
    window.addEventListener("resize", updateVisible);
    return () => window.removeEventListener("resize", updateVisible);
  }, []);

  // Xoay ngang dien thoai/doi kich thuoc cua so lam so the hien thay doi ->
  // ve lai dau, tranh index cu tro sai vi tri sau khi extendedItems doi.
  useEffect(() => {
    setIndex(0);
  }, [visible]);

  const maxIndex = Math.max(0, total - visible);
  // De cuon tiep tuc sang phai muot ma khi het bai (thay vi giat lui ve dau),
  // noi them ban sao cua so the dang hien vao cuoi mang - luc track truot toi
  // cuoi cung (loopResetIndex) thi hien thi y het nhu dang o index 0, nen co
  // the "nhay" ve index 0 that ma mat khong nhan ra.
  const loopResetIndex = total;
  const extendedItems = [...maintenanceTips, ...maintenanceTips.slice(0, visible)];
  const extendedTotal = extendedItems.length;

  useEffect(() => {
    if (maxIndex <= 0) return;
    const id = setInterval(() => {
      // Chan khong cho index vuot qua loopResetIndex (phong khi effect reset
      // ben duoi bi cham/lo nhip) - tranh truot ra khoang trong ngoai mang.
      setIndex((i) => Math.min(i + 1, loopResetIndex));
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [maxIndex, loopResetIndex]);

  useEffect(() => {
    if (!instant) return;
    const raf = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(raf);
  }, [instant]);

  // Khi truot toi vi tri "ao" cuoi cung (giong het frame cua index 0) - cho
  // transition CSS (600ms) chay xong roi nhay tuc thi ve index 0 that. Dung
  // setTimeout thay vi onTransitionEnd vi onTransitionEnd con bi kich hoat
  // "an theo" boi cac transition khac cua the/nut (hover mau, bong do...)
  // do bubbling, khien reset khong on dinh.
  useEffect(() => {
    if (index !== loopResetIndex) return;
    const t = setTimeout(() => {
      setInstant(true);
      setIndex(0);
    }, 600);
    return () => clearTimeout(t);
  }, [index, loopResetIndex]);

  const goPrev = () => setIndex((i) => (i <= 0 ? maxIndex : i - 1));
  const goNext = () => setIndex((i) => Math.min(i + 1, loopResetIndex));

  return (
    <section id="meo-bao-duong" className={`snap-section ${styles.section}`}>
      <div className="container">
        <Reveal className={styles.heading}>
          <span className={styles.eyebrow}>Kinh nghiệm chăm xe</span>
          <h2>Mẹo kiểm tra & xử lý sự cố nhỏ</h2>
        </Reveal>

        <div className={styles.carouselWrap}>
          <button className={styles.arrow} onClick={goPrev} aria-label="Bài trước">
            <ChevronLeft className={styles.arrowIcon} />
          </button>

          <div className={styles.track}>
            <div
              className={styles.trackInner}
              style={{
                width: `${(extendedTotal / visible) * 100}%`,
                transform: `translateX(-${index * (100 / extendedTotal)}%)`,
                transition: instant ? "none" : undefined,
              }}
            >
              {extendedItems.map((tip, i) => {
                const Icon = ICONS[tip.icon];
                return (
                  <div
                    key={`${tip.slug}-${i}`}
                    className={styles.slot}
                    style={{ width: `${100 / extendedTotal}%` }}
                  >
                    <Link href={`/blog/${tip.slug}`} className={styles.card}>
                      <div className={styles.iconWrap}>
                        <Icon className={styles.icon} />
                      </div>
                      <span className={styles.tag}>{tip.tag}</span>
                      <h3>{tip.title}</h3>
                      <p>{tip.excerpt}</p>
                      <span className={styles.readMore}>
                        Đọc chi tiết <ArrowRight className={styles.readMoreIcon} />
                      </span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          <button className={styles.arrow} onClick={goNext} aria-label="Bài tiếp theo">
            <ChevronRight className={styles.arrowIcon} />
          </button>
        </div>

      </div>
    </section>
  );
}
