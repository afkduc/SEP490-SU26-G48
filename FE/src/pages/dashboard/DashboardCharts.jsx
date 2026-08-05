import { useState } from 'react';
import { formatCurrency } from '../../utils';
import { STATUS_LABELS } from '../repairsettlement/mockData';

// Cac hang so + component chart dung chung giua DashboardPage (Co van dich
// vu) va ManagerDashboardPage (Quan ly chi nhanh) - tach rieng de 2 trang
// dung chung 1 nguon ve/mau sac, khong phai copy lai code ve chart.

export const STATUS_ORDER = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];

// Mau trang thai (co dinh, khong doi theo theme) - khop voi mau chu cua cac
// badge trang thai da dung o RepairSettlementPage/CustomerHistoryPage.
export const STATUS_HUES = {
  waiting_repair: '#a1a1aa',
  inprogress: '#52525b',
  waiting_payment: '#3f3f46',
  invoiced: '#18181b',
  cancelled: '#d4d4d8',
};

// Bang mau danh muc dich vu (8 slot, thu tu co dinh - da validate CVD-safe).
// "Phu tung" khong phai 1 danh muc dich vu (khong co category_id) nen dung
// mau xam trung tinh rieng thay vi sinh mau thu 9.
export const CATEGORY_HUES = ['#18181b', '#3f3f46', '#52525b', '#71717a', '#27272a', '#a1a1aa', '#09090b', '#d4d4d8'];
export const PARTS_HUE = '#a1a1aa';

// Loai hinh sua chua THAT (service_order_items.repair_category) - khop voi
// REPAIR_CATEGORY_OPTIONS trong RepairSettlementPage.jsx. Tai su dung bang mau
// CATEGORY_HUES da validate; "Khac" dung mau xam trung tinh nhu PARTS_HUE.
export const REPAIR_CATEGORY_ORDER = ['ER', 'CB', 'EE', 'BP', 'PM', 'OTHER'];
export const REPAIR_CATEGORY_LABELS = {
  ER: 'Sửa chữa động cơ',
  CB: 'Sửa chữa gầm',
  EE: 'Sửa chữa điện - điện tử',
  BP: 'Đồng sơn',
  PM: 'Bảo dưỡng định kỳ',
  OTHER: 'Khác',
};
export const REPAIR_CATEGORY_HUES = {
  ER: CATEGORY_HUES[0],
  CB: CATEGORY_HUES[1],
  EE: CATEGORY_HUES[2],
  BP: CATEGORY_HUES[3],
  PM: CATEGORY_HUES[4],
  OTHER: PARTS_HUE,
};

// ─── Stat tile (KPI card) ─────────────────────────────────────────────
export function StatTile({ label, value }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat__label">{label}</div>
      <div className="dash-stat__value">{value}</div>
    </div>
  );
}

// ─── Line chart: Doanh thu theo tháng ─────────────────────────────────
export function RevenueLineChart({ data }) {
  const width = 560;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 26, left: 54 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 220 }}>
        <h3>Chưa có dữ liệu</h3>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.totalRevenue), 1);
  const niceMax = Math.ceil((maxRevenue || 1) / 4) * 4 || 1;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padding.left + (data.length > 1 ? i * stepX : innerW / 2);
    const y = padding.top + innerH - (d.totalRevenue / niceMax) * innerH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {yTicks.map((t) => {
          const y = padding.top + innerH - (t / niceMax) * innerH;
          return (
            <g key={t}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--gray-200)" strokeWidth="1" />
              <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--gray-500)">
                {t >= 1000000 ? `${(t / 1000000).toFixed(0)}tr` : t.toLocaleString('vi-VN')}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="var(--primary)" opacity="0.1" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.month}>
            <rect
              x={p.x - (data.length > 1 ? stepX / 2 : innerW / 2)} y={padding.top} width={data.length > 1 ? stepX : innerW} height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            />
            <circle
              cx={p.x} cy={p.y} r={hoverIdx === i ? 6 : 4}
              fill="var(--primary)" stroke="var(--white)" strokeWidth="2"
              style={{ pointerEvents: 'none', transition: 'r 0.1s' }}
            />
            <text x={p.x} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--gray-500)">{p.label}</text>
          </g>
        ))}
      </svg>

      {hoverIdx !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(88, Math.max(12, (points[hoverIdx].x / width) * 100))}%`,
            top: 4,
            transform: 'translateX(-50%)',
            background: 'var(--gray-900)', color: 'var(--white)',
            borderRadius: 6, padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap',
            pointerEvents: 'none', zIndex: 10, boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ fontWeight: 700 }}>{formatCurrency(points[hoverIdx].totalRevenue)}</div>
          <div style={{ opacity: 0.8 }}>{points[hoverIdx].label} · {points[hoverIdx].totalOrders} phiếu</div>
        </div>
      )}
    </div>
  );
}

// ─── Stacked bar chart: Số phiếu theo tháng & trạng thái ──────────────
export function StatusStackedBarChart({ data }) {
  const width = 340;
  const height = 220;
  const padding = { top: 16, right: 8, bottom: 26, left: 30 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 220 }}>
        <h3>Chưa có dữ liệu</h3>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.totalOrders), 1);
  const slotW = innerW / data.length;
  const barW = Math.min(28, slotW - 10);
  const gap = 2;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={padding.left} x2={width - padding.right} y1={padding.top + innerH} y2={padding.top + innerH} stroke="var(--gray-300)" strokeWidth="1" />
        {data.map((month, mi) => {
          const x = padding.left + mi * slotW + (slotW - barW) / 2;
          let cursor = 0;
          const segments = STATUS_ORDER.map((status) => {
            const count = month.byStatus[status] || 0;
            const hPx = maxTotal > 0 ? (count / maxTotal) * innerH : 0;
            const bottomY = padding.top + innerH - cursor;
            const topY = bottomY - hPx;
            cursor += hPx;
            return { status, count, topY, h: Math.max(0, hPx - (count > 0 ? gap : 0)) };
          });
          return (
            <g key={month.month}>
              {segments.map((seg) => seg.count > 0 && (
                <rect
                  key={seg.status}
                  x={x} y={seg.topY} width={barW} height={seg.h}
                  rx={2}
                  fill={STATUS_HUES[seg.status]}
                  opacity={hover && (hover.month !== month.month || hover.status !== seg.status) ? 0.45 : 1}
                  onMouseEnter={() => setHover({ month: month.month, status: seg.status, count: seg.count, label: month.label })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
                />
              ))}
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--gray-500)">{month.label}</text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div style={{ fontSize: 11, color: 'var(--gray-700)', textAlign: 'center', marginTop: 2 }}>
          <b>{(STATUS_LABELS[hover.status] || {}).label || hover.status}</b> · {hover.label}: {hover.count} phiếu
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'center' }}>
        {STATUS_ORDER.map((status) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: STATUS_HUES[status] }} />
            <span style={{ color: 'var(--gray-600)' }}>{(STATUS_LABELS[status] || {}).label || status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Donut chart: Trạng thái phiếu ─────────────────────────────────────
export function StatusDonutChart({ data, total }) {
  const size = 170;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 72;
  const rInner = 44;
  const [hover, setHover] = useState(null);

  const nonZero = (data || []).filter((d) => d.count > 0);

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
  const arcs = nonZero.map((d) => {
    // Neu chi co 1 status (vong tron day du), bot 1 chut de tranh diem dau/cuoi
    // trung nhau (arc SVG bi "sup" khong ve duoc khi sweep dung bang 360 do).
    const sweep = nonZero.length === 1 ? 359.9 : (d.count / total) * 360;
    const startAngle = angleCursor + gapDeg / 2;
    const endAngle = angleCursor + sweep - gapDeg / 2;
    angleCursor += sweep;
    return { ...d, startAngle, endAngle };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 150, height: 150, flexShrink: 0 }}>
        {arcs.map((arc) => (
          <path
            key={arc.status}
            d={arcPath(arc.startAngle, arc.endAngle)}
            fill={STATUS_HUES[arc.status]}
            opacity={hover && hover !== arc.status ? 0.35 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
            onMouseEnter={() => setHover(arc.status)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--gray-900)">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--gray-500)">phiếu</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, minWidth: 140 }}>
        {nonZero.map((d) => {
          const st = STATUS_LABELS[d.status] || { label: d.status };
          return (
            <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_HUES[d.status], flexShrink: 0 }} />
              <span style={{ color: 'var(--gray-700)' }}>{st.label}</span>
              <span style={{ color: 'var(--gray-500)', marginLeft: 'auto', fontWeight: 600 }}>{d.count} ({d.percentage}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stacked bar chart: Loại hình sửa chữa theo tháng ─────────────────
export function RepairCategoryStackedBarChart({ data, topCategory }) {
  const width = 340;
  const height = 220;
  const padding = { top: 16, right: 8, bottom: 26, left: 30 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 220 }}>
        <h3>Chưa có dữ liệu</h3>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const slotW = innerW / data.length;
  const barW = Math.min(28, slotW - 10);
  const gap = 2;

  return (
    <div>
      {topCategory && topCategory.orders > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--gray-700)', marginBottom: 10 }}>
          Được sử dụng nhiều nhất:{' '}
          <b style={{ color: REPAIR_CATEGORY_HUES[topCategory.repairCategory] }}>{topCategory.repairCategoryName}</b>
          {' '}({topCategory.orders} phiếu)
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={padding.left} x2={width - padding.right} y1={padding.top + innerH} y2={padding.top + innerH} stroke="var(--gray-300)" strokeWidth="1" />
        {data.map((month, mi) => {
          const x = padding.left + mi * slotW + (slotW - barW) / 2;
          let cursor = 0;
          const segments = REPAIR_CATEGORY_ORDER.map((cat) => {
            const count = month.byCategory[cat] || 0;
            const hPx = maxTotal > 0 ? (count / maxTotal) * innerH : 0;
            const bottomY = padding.top + innerH - cursor;
            const topY = bottomY - hPx;
            cursor += hPx;
            return { cat, count, topY, h: Math.max(0, hPx - (count > 0 ? gap : 0)) };
          });
          return (
            <g key={month.month}>
              {segments.map((seg) => seg.count > 0 && (
                <rect
                  key={seg.cat}
                  x={x} y={seg.topY} width={barW} height={seg.h}
                  rx={2}
                  fill={REPAIR_CATEGORY_HUES[seg.cat]}
                  opacity={hover && (hover.month !== month.month || hover.cat !== seg.cat) ? 0.45 : 1}
                  onMouseEnter={() => setHover({ month: month.month, cat: seg.cat, count: seg.count, label: month.label })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
                />
              ))}
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--gray-500)">{month.label}</text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div style={{ fontSize: 11, color: 'var(--gray-700)', textAlign: 'center', marginTop: 2 }}>
          <b>{REPAIR_CATEGORY_LABELS[hover.cat] || hover.cat}</b> · {hover.label}: {hover.count} phiếu
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'center' }}>
        {REPAIR_CATEGORY_ORDER.map((cat) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: REPAIR_CATEGORY_HUES[cat] }} />
            <span style={{ color: 'var(--gray-600)' }}>{REPAIR_CATEGORY_LABELS[cat]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
