"use client";

import { useEffect, useState } from "react";
import { MapPin, Phone } from "lucide-react";
import Reveal from "./Reveal";
import { API_BASE_URL } from "../config";
import styles from "./Branches.module.css";

// Nhung dung Google Maps Embed API (can API key) - dung dang "search embed"
// khong can key, du khong chinh thuc duoc Google tai lieu hoa nhung duoc
// dung rong rai va on dinh trong thuc te.
function mapEmbedUrl(address) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
}

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/branches`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.success) {
          setBranches(body.data);
          if (body.data.length > 0) setActiveId(body.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  if (branches.length === 0) return null;

  const active = branches.find((b) => b.id === activeId) || branches[0];

  return (
    <section id="chi-nhanh" className={`snap-section ${styles.section}`}>
      <div className="container">
        <Reveal className={styles.heading}>
          <span className={styles.eyebrow}>Hệ thống chi nhánh</span>
          <h2>Chi nhánh AutoGara</h2>
        </Reveal>

        <Reveal delay={0.1} className={styles.panel}>
          <div className={styles.info}>
            <div className={styles.tabs}>
              {branches.map((b) => (
                <button
                  key={b.id}
                  className={`${styles.tab} ${b.id === active.id ? styles.tabActive : ""}`}
                  onClick={() => setActiveId(b.id)}
                >
                  {b.name}
                </button>
              ))}
            </div>

            <div className={styles.detail}>
              <h3>{active.name}</h3>
              {active.address && (
                <p className={styles.item}>
                  <MapPin className={styles.icon} />
                  {active.address}
                </p>
              )}
              {active.phone && (
                <a href={`tel:${active.phone}`} className={styles.item}>
                  <Phone className={styles.icon} />
                  {active.phone}
                </a>
              )}
            </div>
          </div>

          <div className={styles.mapWrap}>
            {active.address ? (
              <iframe
                key={active.id}
                title={`Bản đồ ${active.name}`}
                src={mapEmbedUrl(active.address)}
                className={styles.map}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className={styles.mapFallback}>Chưa có địa chỉ cho chi nhánh này</div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
