import Header from "../components/Header";
import Footer from "../components/Footer";
import LookupForm from "./LookupForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Tra cứu tiến độ sửa chữa",
  description:
    "Nhập mã sửa chữa để xem tiến độ sửa chữa xe của bạn tại AutoGara.",
};

export default function LookupPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={`container ${styles.inner}`}>
          <span className={styles.eyebrow}>Tra cứu trực tuyến</span>
          <h1>Tra cứu tiến độ sửa chữa</h1>
          <p className={styles.desc}>
            Nhập mã sửa chữa được nhân viên gara cung cấp khi tiếp nhận xe để
            xem tình trạng sửa chữa mới nhất.
          </p>
          <LookupForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
