// Component chart dung chung cho Dashboard Tong quan kho - bang top phu
// tung su dung nhieu nhat. Tach rieng file (giong ../dashboard/DashboardCharts.jsx)
// de InventoryDashboardPage.jsx gon hon.

// Bang mau dung cho thanh top phu tung - tai su dung bang mau CATEGORY_HUES
// cua Dashboard CVD de dong bo phong cach mau giua cac trang thong ke.
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
