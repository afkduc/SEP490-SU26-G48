import Link from "next/link";
import Reveal from "./Reveal";
import Footer from "./Footer";
import styles from "./ClosingCta.module.css";

export default function ClosingCta() {
  return (
    <section id="lien-he" className={`snap-section ${styles.section}`}>
      <div className={styles.inner}>
        <Reveal className={`container ${styles.card}`}>
          <span className={styles.eyebrow}>Tra cứu trực tuyến</span>
          <h2>Xe của bạn đang được sửa đến đâu?</h2>
          <p>
            Nhập mã sửa chữa được cung cấp khi tiếp nhận xe để xem tiến độ
            sửa chữa mới nhất — không cần đăng nhập.
          </p>
          <Link href="/tra-cuu" className={styles.button}>
            Tra cứu ngay
          </Link>
        </Reveal>

        <Footer />
      </div>
    </section>
  );
}
