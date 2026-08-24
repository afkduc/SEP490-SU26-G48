import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  AlertTriangle,
  Disc3,
  Snowflake,
  Activity,
  Fuel,
  Clock,
} from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { maintenanceTips, getTipBySlug } from "../../data/maintenanceTips";
import styles from "./page.module.css";

const ICONS = { ClipboardCheck, AlertTriangle, Disc3, Snowflake, Activity, Fuel };

export function generateStaticParams() {
  return maintenanceTips.map((tip) => ({ slug: tip.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tip = getTipBySlug(slug);
  if (!tip) return {};
  return {
    title: tip.title,
    description: tip.excerpt,
  };
}

export default async function MaintenanceTipDetailPage({ params }) {
  const { slug } = await params;
  const tip = getTipBySlug(slug);
  if (!tip) notFound();

  const Icon = ICONS[tip.icon];
  const others = maintenanceTips.filter((t) => t.slug !== slug);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <article className={`container ${styles.article}`}>
          <Link href="/#meo-bao-duong" className={styles.back}>
            <ArrowLeft className={styles.backIcon} />
            Kinh nghiệm chăm xe
          </Link>

          <span className={styles.tag}>{tip.tag}</span>
          <h1>{tip.title}</h1>

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Icon className={styles.metaIcon} />
              AutoGara
            </span>
            <span className={styles.metaItem}>
              <Clock className={styles.metaIcon} />
              {tip.readTime}
            </span>
          </div>

          <p className={styles.intro}>{tip.intro}</p>

          {tip.sections.map((section) => (
            <section key={section.heading} className={styles.block}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {section.list && (
                <ul>
                  {section.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {tip.callout && (
            <div className={styles.callout}>
              <strong>{tip.callout.title}</strong>
              <p>{tip.callout.text}</p>
            </div>
          )}

          <div className={styles.ctaBox}>
            <div>
              <h3>Xe của bạn đang gặp vấn đề tương tự?</h3>
              <p>Để lại thông tin, đội ngũ AutoGara sẽ tư vấn miễn phí.</p>
            </div>
            <Link href="/#gui-yeu-cau" className={styles.ctaBtn}>
              LIÊN HỆ VỚI AUTOGARA
            </Link>
          </div>
        </article>

        <div className={`container ${styles.relatedWrap}`}>
          <h3>Bài viết khác</h3>
          <div className={styles.relatedGrid}>
            {others.map((o) => {
              const OtherIcon = ICONS[o.icon];
              return (
                <Link key={o.slug} href={`/blog/${o.slug}`} className={styles.relatedCard}>
                  <div className={styles.relatedIconWrap}>
                    <OtherIcon className={styles.relatedIcon} />
                  </div>
                  <div>
                    <span className={styles.relatedTag}>{o.tag}</span>
                    <h4>{o.title}</h4>
                  </div>
                  <ArrowRight className={styles.relatedArrow} />
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
