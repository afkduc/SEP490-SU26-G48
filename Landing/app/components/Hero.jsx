"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BASE_PATH } from "../config";
import styles from "./Hero.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" },
  }),
};

const stats = [
  { value: "12+", label: "năm kinh nghiệm" },
  { value: "8.000+", label: "lượt xe đã sửa chữa" },
  { value: "98%", label: "khách hàng hài lòng" },
];

// 4 anh trong Landing/public/cars - dung lam nen carousel cho Hero.
const SLIDES = [
  `${BASE_PATH}/cars/KTVsuaxe1.png`,
  `${BASE_PATH}/cars/KTVsuaxe2.png`,
  `${BASE_PATH}/cars/KTVsuaxe3.png`,
  `${BASE_PATH}/cars/KTVsuaxe4.png`,
];

const SLIDE_INTERVAL_MS = 5000;

export default function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="trang-chu" className={`snap-section ${styles.hero}`}>
      <div className={styles.carousel} aria-hidden="true">
        <AnimatePresence>
          <motion.div
            key={active}
            className={styles.slide}
            style={{ backgroundImage: `url(${SLIDES[active]})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          />
        </AnimatePresence>
        <div className={styles.scrim} />
      </div>

      <div className={styles.dots}>
        {SLIDES.map((src, i) => (
          <button
            key={src}
            className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Ảnh ${i + 1}`}
          />
        ))}
      </div>

      <div className={`container ${styles.inner}`}>
        <motion.span
          className={styles.badge}
          initial="hidden"
          animate="show"
          custom={0}
          variants={fadeUp}
        >
          Gara chuyên sâu Kia & Mazda
        </motion.span>

        <motion.h1
          className={styles.title}
          initial="hidden"
          animate="show"
          custom={1}
          variants={fadeUp}
        >
          AutoGara
          <br />
          <span>Đồng hành trọn vẹn, chăm sóc tận tâm</span>
        </motion.h1>

        <motion.p
          className={styles.subtitle}
          initial="hidden"
          animate="show"
          custom={2}
          variants={fadeUp}
        >
          AutoGara chuyên sửa chữa, bảo dưỡng chính hãng cho xe được mua tại Showroom AutoGara. Đội ngũ kỹ thuật trình độ cao luôn tận tình, nhiệt huyết và minh bạch
        </motion.p>

        <motion.div
          className={styles.stats}
          initial="hidden"
          animate="show"
          custom={3}
          variants={fadeUp}
        >
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
