import { ShieldCheck, BadgeCheck, Wrench, Gauge } from "lucide-react";
import Reveal from "./Reveal";
import styles from "./WhyChooseUs.module.css";

const REASONS = [
  {
    icon: ShieldCheck,
    title: "Ủy quyền chính hãng Mazda",
    desc: "AutoGara là gara dịch vụ được Mazda ủy quyền chính thức, vận hành đúng quy trình và tiêu chuẩn kỹ thuật của hãng.",
  },
  {
    icon: BadgeCheck,
    title: "Phụ tùng chính hãng 100%",
    desc: "Toàn bộ phụ tùng thay thế đều là hàng chính hãng Mazda, có tem bảo hành đầy đủ - không dùng phụ tùng trôi nổi.",
  },
  {
    icon: Wrench,
    title: "Kỹ thuật viên được hãng đào tạo",
    desc: "Đội ngũ kỹ thuật viên được đào tạo và cấp chứng chỉ trực tiếp từ Mazda, nắm rõ đặc thù riêng của từng dòng xe.",
  },
  {
    icon: Gauge,
    title: "Thiết bị chẩn đoán chuyên dụng",
    desc: "Đầu tư máy chẩn đoán và thiết bị chuyên dụng riêng cho Mazda, đọc đúng lỗi thay vì đoán mò và thay nhầm phụ tùng.",
  },
];

export default function WhyChooseUs() {
  return (
    <section id="vi-sao-chon" className={`snap-section ${styles.section}`}>
      <div className="container">
        <Reveal className={styles.heading}>
          <span className={styles.eyebrow}>Vì sao chọn AutoGara</span>
          <h2>Gara chuyên sâu, ủy quyền chính hãng Mazda</h2>
        </Reveal>

        <div className={styles.grid}>
          {REASONS.map((r, i) => {
            const Icon = r.icon;
            return (
              <Reveal key={r.title} delay={i * 0.08} className={styles.card}>
                <div className={styles.iconWrap}>
                  <Icon className={styles.icon} />
                </div>
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
