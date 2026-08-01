import { useState } from 'react';

// Component chart dung chung cho Dashboard Tong quan kho - bieu do tron
// (donut) hang phu tung + bang top phu tung su dung nhieu nhat. Tach rieng
// file (giong ../dashboard/DashboardCharts.jsx) de InventoryDashboardPage.jsx
// gon hon.

// Bang mau hang (brand) - tai su dung bang mau CATEGORY_HUES cua Dashboard
// CVD de dong bo phong cach mau giua cac trang thong ke.
export const BRAND_HUES = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
export const OTHER_HUE = '#94a3b8';

export function brandColor(index) {
  return index < BRAND_HUES.length ? BRAND_HUES[index] : OTHER_HUE;
}

// ─── Stat tile (KPI card) - tai su dung style .dash-stat ──────────────
export function StatTile({ label, value }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat__label">{label}</div>
      <div className="dash-stat__value">{value}</div>
    </div>
  );
}

// ─── Donut chart: Phan bo theo hang (brand) ───────────────────────────
export function BrandDonutChart({ data }) {
  const size = 170;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 72;
  const rInner = 44;
  const [hover, setHover] = useState(null);

  const nonZero = (data || []).filter((d) => d.totalQuantity > 0);
  const total = nonZero.reduce((sum, d) => sum + d.totalQuantity, 0);

  if (nonZero.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 180 }}>
        <h3>Chưa có dữ liệu</h3>
      </div>
    );
  }

  function polarToCartesian(r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arcPath(startAngle, endAngle) {
    const so = polarToCartesian(rOuter, startAngle);
    const eo = polarToCartesian(rOuter, endAngle);
    const si = polarToCartesian(rInner, endAngle);
    const ei = polarToCartesian(rInner, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${so.x} ${so.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${eo.x} ${eo.y} L ${si.x} ${si.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${ei.x} ${ei.y} Z`;
  }

  let angleCursor = -90;
  const gapDeg = nonZero.length > 1 ? 2.5 : 0;
  const arcs = nonZero.map((d, i) => {
    const sweep = nonZero.length === 1 ? 359.9 : (d.totalQuantity / total) * 360;
    const startAngle = angleCursor + gapDeg / 2;
    const endAngle = angleCursor + sweep - gapDeg / 2;
    angleCursor += sweep;
    return { ...d, startAngle, endAngle, color: brandColor(i) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 150, height: 150, flexShrink: 0 }}>
        {arcs.map((arc) => (
          <path
            key={arc.brandName}
            d={arcPath(arc.startAngle, arc.endAngle)}
            fill={arc.color}
            opacity={hover && hover !== arc.brandName ? 0.35 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
            onMouseEnter={() => setHover(arc.brandName)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--gray-900)">{total.toLocaleString('vi-VN')}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--gray-500)">phụ tùng</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, minWidth: 160, maxHeight: 150, overflowY: 'auto' }}>
        {arcs.map((d) => (
          <div key={d.brandName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--gray-700)' }}>{d.brandName}</span>
            <span style={{ color: 'var(--gray-500)', marginLeft: 'auto', fontWeight: 600 }}>{d.totalQuantity.toLocaleString('vi-VN')} ({d.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal bar chart: Top phu tung su dung nhieu nhat ────────────
export function TopPartsBarChart({ data }) {
  const nonZero = (data || []).filter((d) => d.totalQuantity > 0);

  if (nonZero.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 220 }}>
        <h3>Chưa có dữ liệu</h3>
      </div>
    );
  }

  const maxQty = Math.max(...nonZero.map((d) => d.totalQuantity), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {nonZero.map((d, i) => {
        const pct = Math.max(2, (d.totalQuantity / maxQty) * 100);
        return (
          <div key={d.productId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 20, textAlign: 'right', fontSize: 11, color: 'var(--gray-500)', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--gray-800)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.productName}>
                  {d.productName}
                </span>
                <span style={{ color: 'var(--gray-600)', flexShrink: 0 }}>{d.totalQuantity.toLocaleString('vi-VN')} {d.unit}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--gray-100)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: brandColor(0) }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
