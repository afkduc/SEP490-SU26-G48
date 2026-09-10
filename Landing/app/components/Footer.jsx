"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import { API_BASE_URL } from "../config";
import styles from "./Footer.module.css";

const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61592097516986";

const menuLinks = [
  { href: "/#trang-chu", label: "Trang chủ" },
  { href: "/#vi-sao-chon", label: "Vì sao chọn AutoGara" },
  { href: "/#service-packages", label: "Gói dịch vụ" },
  { href: "/#chi-nhanh", label: "Chi nhánh" },
  { href: "/#meo-bao-duong", label: "Kinh nghiệm" },
  { href: "/#gui-yeu-cau", label: "Liên hệ" },
  { href: "/lookup", label: "Tra cứu tiến độ" },
];

// Icon Facebook don gian tu ve (khong dung anh/logo chinh hang) - chi la
// hinh chu "f" quen thuoc trong vong tron, dung tam theo dia chi FB da co.
function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M14 13.5h2.2l.4-2.7H14V9c0-1 .3-1.7 1.7-1.7H16.7V4.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.8H8.3v2.7h2.2V21h2.8V13.5Z" />
    </svg>
  );
}

export default function Footer() {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/branches`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.success) setBranches(body.data);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.col}>
          <p className={styles.logo}>
            <span>Auto</span>Gara
          </p>
          <p className={styles.about}>Gara ủy quyền chính hãng Mazda.</p>
          <a href="mailto:cskh@autogara.vn" className={styles.item}>
            <Mail className={styles.icon} />
            cskh@autogara.vn
          </a>
        </div>

        <div className={styles.col}>
          <h4>Chi nhánh</h4>
          {branches.map((b) => (
            <div key={b.id} className={styles.branch}>
              <p className={styles.branchName}>{b.name}</p>
              {b.address && (
                <p className={styles.item}>
                  <MapPin className={styles.icon} />
                  {b.address}
                </p>
              )}
              {b.phone && (
                <a href={`tel:${b.phone}`} className={styles.item}>
                  <Phone className={styles.icon} />
                  {b.phone}
                </a>
              )}
            </div>
          ))}
        </div>

        <div className={styles.col}>
          <h4>Danh mục</h4>
          <div className={styles.links}>
            {menuLinks.map((l) => (
              <Link key={l.label} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.col}>
          <h4>Liên kết</h4>
          <div className={styles.socials}>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook AutoGara"
              className={styles.socialBtn}
            >
              <FacebookIcon className={styles.socialIcon} />
            </a>
          </div>
          <p className={styles.copy}>
            © {new Date().getFullYear()} AutoGara. Gara chuyên Mazda.
          </p>
        </div>
      </div>
    </footer>
  );
}
