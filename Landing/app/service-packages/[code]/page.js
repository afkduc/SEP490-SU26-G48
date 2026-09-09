import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Wrench, ClipboardList } from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { API_BASE_URL } from "../../config";
import styles from "./page.module.css";

const CATEGORY_ICONS = {
  "Bảo dưỡng định kỳ": Wrench,
  "Bảo dưỡng cơ bản": Wrench,
};

function formatPrice(value) {
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

/** An ten mau xe cu the tren trang public (giu dung moc bao duong). */
function publicPackageTitle(name) {
  const raw = String(name || "");
  if (/1\.000\s*km\s*đầu/i.test(raw)) return "Gói bảo dưỡng 1.000km đầu";
  const cap = raw.match(/Cấp\s*(\d+)/i);
  if (cap) return `Gói bảo dưỡng Cấp ${cap[1]}`;
  return raw.replace(/\s*-\s*.+$/, "").trim() || raw;
}

function cleanPublicText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\s*dành cho\s+[^.]+?(?=\s*\(|\s*\.|$)/gi, "")
    .replace(/\s*dành riêng cho\s+[^.]+?(?=,|\.|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
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
    title: publicPackageTitle(pkg.name),
    description: cleanPublicText(pkg.description),
  };
}

export default async function ServicePackageDetailPage({ params }) {
  const { code } = await params;
  const [pkg, allPackages] = await Promise.all([getPackage(code), getAllPackages()]);
  if (!pkg) notFound();

  const Icon = CATEGORY_ICONS[pkg.categoryName] || ClipboardList;
  const title = publicPackageTitle(pkg.name);
  const description = cleanPublicText(pkg.description);
  const purpose = cleanPublicText(pkg.purpose);

  // Goi lien quan: gop theo moc, bo trung lap ten sau khi an mau xe.
  const relatedMap = new Map();
  allPackages.forEach((p) => {
    if (p.code === code) return;
    if (!String(p.categoryName || "").toLowerCase().includes("bảo dưỡng")) return;
    const label = publicPackageTitle(p.name);
    if (relatedMap.has(label)) return;
    relatedMap.set(label, { code: p.code, name: label, totalPrice: p.totalPrice });
  });
  const others = [...relatedMap.values()].slice(0, 4);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <article className={`container ${styles.article}`}>
          <Link href="/#service-packages" className={styles.back}>
            <ArrowLeft className={styles.backIcon} />
            Gói dịch vụ
          </Link>

          {pkg.categoryName && (
            <span className={styles.tag}>
              <Icon style={{ width: 13, height: 13, marginRight: 5 }} />
              {pkg.categoryName}
            </span>
          )}
          <h1>{title}</h1>

          <div className={styles.priceBox}>
            <span className={styles.price}>{formatPrice(pkg.totalPrice)}</span>
          </div>

          {description && <p className={styles.intro}>{description}</p>}

          {purpose && (
            <section className={styles.block}>
              <h2>Gói này dùng để làm gì?</h2>
              <p>{purpose}</p>
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
                <Link key={o.code} href={`/service-packages/${o.code}`} className={styles.relatedCard}>
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
