import Header from "../components/Header";
import Footer from "../components/Footer";
import LookupTabs from "./LookupTabs";
import styles from "./page.module.css";

export const metadata = {
  title: "Tra cứu tiến độ sửa chữa",
  description:
    "Nhập mã sửa chữa hoặc biển số/số khung xe để tra cứu tiến độ và lịch sử bảo dưỡng tại AutoGara.",
};

export default function LookupPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={`container ${styles.inner}`}>
          <span className={styles.eyebrow}>Tra cứu trực tuyến</span>
          <h1>Tra cứu sửa chữa &amp; bảo dưỡng</h1>
          <p className={styles.desc}>
            Nhập mã sửa chữa được nhân viên gara cung cấp khi tiếp nhận xe để
            xem tiến độ, hoặc tra cứu theo biển số/số khung để xem lại lịch sử
            bảo dưỡng xe của bạn.
          </p>
          <LookupTabs />
        </div>
      </main>
      <Footer />
    </>
  );
}
