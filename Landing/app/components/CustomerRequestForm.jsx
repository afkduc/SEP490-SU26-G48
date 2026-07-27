"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import Reveal from "./Reveal";
import { API_BASE_URL } from "../config";
import styles from "./CustomerRequestForm.module.css";

const initialForm = {
  fullName: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  issue: "",
  purchaseBranchId: "",
  purchaseBranchOther: "",
  vehicleBrandId: "",
  nearestBranchId: "",
};

export default function CustomerRequestForm() {
  const [form, setForm] = useState(initialForm);
  const [branches, setBranches] = useState([]);
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/branches`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.success) setBranches(body.data);
      })
      .catch(() => {
        // Im lang neu loi - dropdown chi nhanh se rong, khong chan duoc form
        // con lai (khach van dien duoc cac truong khac).
      });

    fetch(`${API_BASE_URL}/public/vehicle-brands`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.success) setVehicleBrands(body.data);
      })
      .catch(() => { });
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/public/service-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          gender: form.gender || null,
          phone: form.phone,
          email: form.email || null,
          address: form.address || null,
          issue: form.issue,
          purchaseBranchId:
            form.purchaseBranchId && form.purchaseBranchId !== "other"
              ? Number(form.purchaseBranchId)
              : null,
          purchaseBranchOther: form.purchaseBranchId === "other" ? form.purchaseBranchOther : null,
          vehicleBrandId: form.vehicleBrandId ? Number(form.vehicleBrandId) : null,
          nearestBranchId: Number(form.nearestBranchId),
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        setError(body?.message || "Gửi yêu cầu thất bại. Vui lòng thử lại.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setForm(initialForm);
    } catch {
      setError("Không thể kết nối tới máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="gui-yeu-cau" className={`snap-section ${styles.section}`}>
      <div className={`container ${styles.inner}`}>
        <Reveal className={styles.heading}>
          <h2>Để lại thông tin, chúng tôi sẽ liên hệ trong thời gian sớm nhất</h2>
        </Reveal>

        <Reveal delay={0.1} className={styles.formCard}>
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                className={styles.success}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <CheckCircle2 className={styles.successIcon} />
                <h3>Đã nhận thông tin!</h3>
                <p>Cảm ơn bạn. AutoGara sẽ liên hệ lại sớm nhất.</p>
                <button type="button" className={styles.againBtn} onClick={() => setSubmitted(false)}>
                  Gửi yêu cầu khác
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className={styles.form}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className={styles.row}>
                  <label className={styles.field}>
                    <span>Họ và tên *</span>
                    <input name="fullName" value={form.fullName} onChange={handleChange} required />
                  </label>
                  <label className={styles.field}>
                    <span>Giới tính</span>
                    <select name="gender" value={form.gender} onChange={handleChange}>
                      <option value="">Chọn</option>
                      <option value="nam">Nam</option>
                      <option value="nu">Nữ</option>
                      <option value="khac">Khác</option>
                    </select>
                  </label>
                </div>

                <div className={styles.row}>
                  <label className={styles.field}>
                    <span>Số điện thoại *</span>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} required />
                  </label>
                  <label className={styles.field}>
                    <span>Email</span>
                    <input type="email" name="email" value={form.email} onChange={handleChange} />
                  </label>
                </div>

                <label className={styles.field}>
                  <span>Địa chỉ</span>
                  <input name="address" value={form.address} onChange={handleChange} />
                </label>

                <div className={styles.row}>
                  <label className={styles.field}>
                    <span>Chi nhánh mua xe</span>
                    <select name="purchaseBranchId" value={form.purchaseBranchId} onChange={handleChange}>
                      <option value="">Chọn chi nhánh</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                      <option value="other">Khác</option>
                    </select>
                  </label>
                  {form.purchaseBranchId === "other" && (
                    <label className={styles.field}>
                      <span>Nơi mua xe</span>
                      <input
                        name="purchaseBranchOther"
                        value={form.purchaseBranchOther}
                        onChange={handleChange}
                      />
                    </label>
                  )}
                </div>

                <label className={styles.field}>
                  <span>Hãng xe</span>
                  <select name="vehicleBrandId" value={form.vehicleBrandId} onChange={handleChange}>
                    <option value="" disabled>
                      Chọn hãng xe của bạn?
                    </option>
                    {vehicleBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Vị trí *</span>
                  <select name="nearestBranchId" value={form.nearestBranchId} onChange={handleChange} required>
                    <option value="" disabled>
                      Hiện tại vị trí của bạn đang gần chi nhánh AutoGara nào nhất?
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Vấn đề xe đang gặp phải *</span>
                  <textarea name="issue" value={form.issue} onChange={handleChange} rows={2} required />
                </label>

                {error && <p className={styles.error}>{error}</p>}

                <button type="submit" className={styles.submit} disabled={submitting}>
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}
