"use client";

import { useState } from "react";
import LookupForm from "./LookupForm";
import VehicleHistoryLookupForm from "./VehicleHistoryLookupForm";
import styles from "./TraCuuTabs.module.css";

const TABS = [
  { key: "code", label: "Theo mã sửa chữa" },
  { key: "vehicle", label: "Theo biển số / số khung" },
];

export default function TraCuuTabs() {
  const [tab, setTab] = useState("code");

  return (
    <div>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "code" ? <LookupForm /> : <VehicleHistoryLookupForm />}
    </div>
  );
}
