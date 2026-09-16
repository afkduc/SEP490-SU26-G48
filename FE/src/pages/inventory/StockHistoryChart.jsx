import { useState } from 'react';

// Bieu do bien dong ton kho cua 1 phu tung: duong bac thang (ton kho doi
// theo tung giao dich roi giu nguyen cho toi giao dich sau), moi giao dich
// 1 diem - xanh la = cong (nhap/hoan), do = tru (xuat). Tu ve bang SVG cho
// dong bo voi cac bieu do Dashboard, khong keo them thu vien.
//
// Truc X dat DEU theo thu tu giao dich chu khong theo thoi gian that - vi
// nhap kho 1 lan roi xuat le te nhieu ngay sau, ve theo thoi gian se dinh
// cum vao 1 goc khong nhin duoc "moi lan len xuong" nhu yeu cau.

const TYPE_META = {
  import: { label: 'Nhập kho', color: '#16a34a', sign: '+' },
  return: { label: 'Hoàn hàng', color: '#16a34a', sign: '+' },
  export: { label: 'Xuất kho', color: '#dc2626', sign: '−' },
};

function metaOf(type) {
  return TYPE_META[type] || { label: type, color: '#64748b', sign: '' };
}

const W = 900;
const H = 240;
const PAD = { top: 20, right: 24, bottom: 36, left: 48 };

export function StockHistoryChart({ history, unit }) {
  const [hover, setHover] = useState(null);

  if (!history || !history.events || history.events.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 120 }}>
        <p>Chưa có giao dịch nhập/xuất nào cho phụ tùng này.</p>
      </div>
    );
  }

  // Diem 0 = ton dau ky (truoc giao dich dau tien), sau do moi giao dich 1 diem.
  const points = [
    { balance: history.openingStock, event: null },
    ...history.events.map((e) => ({ balance: e.balanceAfter, event: e })),
  ];
  const n = points.length;
  const maxY = Math.max(1, ...points.map((p) => p.balance));
  const minY = Math.min(0, ...points.map((p) => p.balance));
  const spanY = maxY - minY || 1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.top + innerH - ((v - minY) / spanY) * innerH;

  // Duong bac thang: tu diem i sang ngang toi x(i+1) roi doc len/xuong y(i+1).
  let d = `M ${x(0)} ${y(points[0].balance)}`;
  for (let i = 1; i < n; i += 1) {
    d += ` H ${x(i)} V ${y(points[i].balance)}`;
  }

  // 4 vach ngang tham chieu tren truc Y.
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, k) => Math.round(minY + (spanY * k) / ticks));

  const hovered = hover != null ? points[hover] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--gray-200, #e5e7eb)" strokeDasharray="3 3" />
            <text x={PAD.left - 8} y={y(t) + 4} fontSize="11" fill="var(--gray-500, #6b7280)" textAnchor="end">{t}</text>
          </g>
        ))}

        <path d={d} fill="none" stroke="var(--primary, #4f46e5)" strokeWidth="2" />

        {points.map((p, i) => {
          const m = p.event ? metaOf(p.event.type) : { color: '#94a3b8' };
          const active = hover === i;
          return (
            <g key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: p.event ? 'pointer' : 'default' }}>
              {/* vung bat chuot rong hon cham thuc de de tro */}
              <circle cx={x(i)} cy={y(p.balance)} r="12" fill="transparent" />
              <circle cx={x(i)} cy={y(p.balance)} r={active ? 7 : 5} fill={m.color} stroke="#fff" strokeWidth="2" />
              {p.event && (
                <text x={x(i)} y={y(p.balance) + (p.event.delta > 0 ? -12 : 20)} fontSize="11" fontWeight="700"
                  fill={m.color} textAnchor="middle">
                  {metaOf(p.event.type).sign}{Math.abs(p.event.delta)}
                </text>
              )}
            </g>
          );
        })}

        <text x={PAD.left} y={H - 10} fontSize="11" fill="var(--gray-500, #6b7280)">Đầu kỳ</text>
        <text x={W - PAD.right} y={H - 10} fontSize="11" fill="var(--gray-500, #6b7280)" textAnchor="end">Mới nhất</text>
      </svg>

      {hovered && (
        <div style={{
          position: 'absolute',
          left: `${(x(hover) / W) * 100}%`,
          top: 0,
          transform: 'translate(-50%, -100%)',
          background: '#111827',
          color: '#fff',
          fontSize: 12,
          lineHeight: 1.5,
          padding: '8px 10px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {hovered.event ? (
            <>
              <div style={{ fontWeight: 700, color: metaOf(hovered.event.type).color }}>
                {metaOf(hovered.event.type).label} {metaOf(hovered.event.type).sign}{Math.abs(hovered.event.delta)} {unit}
              </div>
              <div>Phiếu: <b>{hovered.event.slipCode || hovered.event.transactionCode || '—'}</b></div>
              <div>Lúc: {hovered.event.happenedAtLabel || '—'}</div>
              <div>Tồn sau: <b>{hovered.balance} {unit}</b></div>
            </>
          ) : (
            <div>Tồn đầu kỳ: <b>{hovered.balance} {unit}</b></div>
          )}
        </div>
      )}
    </div>
  );
}

// Bang liet ke tung giao dich (moi nhat len tren) - doi chieu chi tiet cho
// bieu do o tren.
export function StockHistoryTable({ history, unit }) {
  if (!history || !history.events || history.events.length === 0) return null;
  const rows = [...history.events].reverse();
  return (
    <div className="table-responsive" style={{ marginTop: 16 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Loại</th>
            <th>Phiếu</th>
            <th>Người thực hiện</th>
            <th className="text-right">Số lượng</th>
            <th className="text-right">Tồn sau</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const m = metaOf(e.type);
            return (
              <tr key={e.id}>
                <td>{e.happenedAtLabel || '—'}</td>
                <td><span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span></td>
                <td><span className="font-mono">{e.slipCode || e.transactionCode || '—'}</span></td>
                <td>{e.performedByName || '—'}</td>
                <td className="text-right" style={{ color: m.color, fontWeight: 700 }}>
                  {m.sign}{Math.abs(e.delta)} {unit}
                </td>
                <td className="text-right">{e.balanceAfter} {unit}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
