"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BASE_PATH } from "../config";
import styles from "./Header.module.css";

// Dung "/#id" (co dau "/" o dau) chu khong phai "#id" - vi Header con duoc
// render o ca trang khac (/lookup, /blog/...), href "#id" suong se
// chi nhay trong CHINH trang dang dung (khong co section do) nen khong chay
// duoc gi. "/#id" luon dieu huong ve trang chu roi cuon toi dung section.
//
// "Trang chu" dung "/#trang-chu" (co hash) chu KHONG dung "/" suong - vi
// Next Link voi href khong co hash se dung co che "giu nguyen vi tri cuon"
// (xem link.md), khong biet reset scrollTop cua div ".snap-container"
// (khung cuon rieng ben trong trang chu, khac voi scroll cua window) nen
// tu trang khac bam vao se khong ve dung man Hero. Dung hash de tan dung
// lai co che cuon-toi-id da chay dung cho cac muc khac.
const navLinks = [
  { href: "/#trang-chu", label: "Trang chủ" },
  { href: "/#vi-sao-chon", label: "Vì sao chọn AutoGara" },
  { href: "/#service-packages", label: "Gói dịch vụ" },
  { href: "/#chi-nhanh", label: "Chi nhánh" },
  { href: "/#meo-bao-duong", label: "Kinh nghiệm" },
  { href: "/#gui-yeu-cau", label: "Liên hệ" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/#trang-chu" className={styles.logo}>
          <img
            src={`${BASE_PATH}/cars/AutoGaraLogo-Photoroom.png`}
            alt="AutoGara"
            width={150}
            height={100}
          />
        </Link>

        <nav className={styles.nav}>
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href="/lookup" className={styles.cta}>
            Tra cứu tiến độ
          </Link>
        </nav>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={styles.burger}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={menuOpen}
        >
          <Menu className={`${styles.icon} ${menuOpen ? styles.iconHidden : styles.iconShown}`} />
          <X className={`${styles.icon} ${menuOpen ? styles.iconShown : styles.iconHidden}`} />
        </button>
      </div>

      <div
        className={`${styles.overlay} ${menuOpen ? styles.overlayOpen : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <div className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ""}`}>
        <div className={styles.drawerLinks}>
          {navLinks.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`${styles.drawerLink} ${menuOpen ? styles.drawerItemIn : styles.drawerItemOut}`}
              style={{ transitionDelay: menuOpen ? `${150 + i * 70}ms` : "0ms" }}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Link
          href="/lookup"
          onClick={() => setMenuOpen(false)}
          className={`${styles.drawerCta} ${menuOpen ? styles.drawerItemIn : styles.drawerItemOut}`}
          style={{ transitionDelay: menuOpen ? "360ms" : "0ms" }}
        >
          Tra cứu tiến độ sửa xe
        </Link>
      </div>
    </header>
  );
}
