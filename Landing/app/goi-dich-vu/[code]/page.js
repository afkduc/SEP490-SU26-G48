import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Wrench, Sparkles, Disc3, Snowflake, ClipboardList } from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { API_BASE_URL } from "../../config";
import styles from "./page.module.css";

const CATEGORY_ICONS = {
  "Bảo dưỡng định kỳ": Wrench,
  "Chăm sóc xe": Sparkles,
  "Phanh & Gầm": Disc3,
  "Điều hòa": Snowflake,
};

function formatPrice(value) {
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

async function getPackage(code) {
  const res = await fetch(`${API_BASE_URL}/public/service-packages/${code}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.success ? body.data : null;
}

async function getAllPackages() {
  const res = await fetch(`${API_BASE_URL}/public/service-packages`, { cache: "no-store" });
  if (!res.ok) return [];
  const body = await res.json().catch(() => null);
  return body?.success ? body.data : [];
}

export async function generateMetadata({ params }) {
  const { code } = await params;
  const pkg = await getPackage(code);
  if (!pkg) return {};
  return {
    title: pkg.name,
    description: pkg.description,
  };
}

export default async function ServicePackageDetailPage({ params }) {
  const { code } = await params;
  const [pkg, allPackages] = await Promise.all([getPackage(code), getAllPackages()]);
  if (!pkg) notFound();

  const Icon = CATEGORY_ICONS[pkg.categoryName] || ClipboardList;
  const others = allPackages.filter((p) => p.code !== code).slice(0, 4);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <article className={`container ${styles.article}`}>
          <Link href="/#goi-dich-vu" className={styles.back}>
            <ArrowLeft className={styles.backIcon} />
            Gói dịch vụ
          </Link>

          {pkg.categoryName && (
            <span className={styles.tag}>
              <Icon style={{ width: 13, height: 13, marginRight: 5 }} />
              {pkg.categoryName}
            </span>
          )}
          <h1>{pkg.name}</h1>

          <div className={styles.priceBox}>
            <span className={styles.price}>{formatPrice(pkg.totalPrice)}</span>
          </div>

          {pkg.description && <p className={styles.intro}>{pkg.description}</p>}

          {pkg.purpose && (
            <section className={styles.block}>
              <h2>Gói này dùng để làm gì?</h2>
              <p>{pkg.purpose}</p>
            </section>
          )}

          {pkg.items?.length > 0 && (
            <section className={styles.block}>
              <h2>Gói này gồm những gì?</h2>
              <div className={styles.itemsList}>
                {pkg.items.map((item) => (
                  <div key={item.name} className={styles.itemRow}>
                    <Check className={styles.itemIcon} />
                    <span className={styles.itemName}>{item.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className={styles.callout}>
            <strong>Lưu ý về giá</strong>
            <p>
              Giá trên chỉ mang tính tham khảo, có thể chênh lệch theo chi
              nhánh, dòng xe và tình trạng thực tế của xe. Để lại thông tin
              bên dưới để được kỹ thuật viên tư vấn và báo giá chính xác
              trước khi thực hiện.
            </p>
          </div>

          <div className={styles.ctaBox}>
            <div>
              <h3>Muốn đặt lịch gói này?</h3>
              <p>Để lại thông tin, đội ngũ AutoGara sẽ liên hệ tư vấn.</p>
            </div>
            <Link href="/#gui-yeu-cau" className={styles.ctaBtn}>
              LIÊN HỆ VỚI AUTOGARA
            </Link>
          </div>
        </article>

        {others.length > 0 && (
          <div className={`container ${styles.relatedWrap}`}>
            <h3>Gói dịch vụ khác</h3>
            <div className={styles.relatedGrid}>
              {others.map((o) => (
                <Link key={o.code} href={`/goi-dich-vu/${o.code}`} className={styles.relatedCard}>
                  <span className={styles.relatedName}>{o.name}</span>
                  <span className={styles.relatedPrice}>{formatPrice(o.totalPrice)}</span>
                  <ArrowRight className={styles.relatedArrow} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
