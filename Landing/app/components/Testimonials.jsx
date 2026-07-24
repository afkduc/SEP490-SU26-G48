import { Star } from "lucide-react";
import Reveal from "./Reveal";
import styles from "./Testimonials.module.css";

// Noi dung minh hoa - THAY BANG DANH GIA THAT cua khach hang truoc khi
// deploy len production.
const TESTIMONIALS = [
  {
    name: "Khách hàng sử dụng Mazda CX-5",
    quote:
      "Xe được kỹ thuật viên kiểm tra kỹ và giải thích rõ từng hạng mục trước khi sửa, phụ tùng thay đúng là hàng chính hãng Mazda nên rất yên tâm.",
  },
  {
    name: "Khách hàng sử dụng Kia Seltos",
    quote:
      "Đặt lịch qua trang web nhanh gọn, đến nơi không phải chờ lâu. Xe bảo dưỡng định kỳ xong chạy êm hẳn so với trước.",
  },
  {
    name: "Khách hàng sử dụng Kia Morning",
    quote:
      "Tra cứu tiến độ sửa xe online rất tiện, không cần gọi điện hỏi liên tục như trước đây. Nhân viên tư vấn cũng nhiệt tình.",
  },
];

export default function Testimonials() {
  return (
    <section id="danh-gia" className={`snap-section ${styles.section}`}>
      <div className="container">
        <Reveal className={styles.heading}>
          <span className={styles.eyebrow}>Khách hàng nói gì</span>
          <h2>Được khách hàng Kia & Mazda tin tưởng</h2>
        </Reveal>

        <div className={styles.grid}>
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08} className={styles.card}>
              <div className={styles.stars}>
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className={styles.star} />
                ))}
              </div>
              <p className={styles.quote}>“{t.quote}”</p>
              <p className={styles.name}>{t.name}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
