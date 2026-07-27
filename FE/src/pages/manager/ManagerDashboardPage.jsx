import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AppContext';
import { getDashboardOverviewApi } from '../../services/dashboardApi';
import { formatCurrency } from '../../utils';
import { STATUS_LABELS } from '../repairsettlement/mockData';
import {
  STATUS_ORDER, REPAIR_CATEGORY_HUES,
  StatTile, RevenueLineChart, StatusStackedBarChart, StatusDonutChart, RepairCategoryStackedBarChart,
} from '../dashboard/DashboardCharts';
import '../dashboard/DashboardPage.css';

const CURRENT_YEAR = new Date().getFullYear();
// Ngoai cac khoang co san (giong trang Co van), them rieng lua chon "Theo
// nam" - quan ly can xem doanh thu ca nam de doi chieu voi ke hoach/bao cao
// theo nam, khong chi xem theo khoang gan day.
const DATE_PRESETS = [
  { key: 'all', label: 'Tất cả thời gian' },
  { key: 'month', label: 'Tháng này' },
  { key: '3m', label: '3 tháng gần đây' },
  { key: '6m', label: '6 tháng gần đây' },
  { key: `year:${CURRENT_YEAR}`, label: `Năm ${CURRENT_YEAR}` },
  { key: `year:${CURRENT_YEAR - 1}`, label: `Năm ${CURRENT_YEAR - 1}` },
  { key: `year:${CURRENT_YEAR - 2}`, label: `Năm ${CURRENT_YEAR - 2}` },
];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function computeDateRange(presetKey) {
  if (presetKey.startsWith('year:')) {
    const year = Number(presetKey.split(':')[1]);
    return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
  }
  const now = new Date();
  if (presetKey === 'month') {
    return { fromDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), toDate: toISODate(now) };
  }
  if (presetKey === '3m') {
    return { fromDate: toISODate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), toDate: toISODate(now) };
  }
  if (presetKey === '6m') {
    return { fromDate: toISODate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), toDate: toISODate(now) };
  }
  return { fromDate: '', toDate: '' };
}

// ─── Trang Dashboard riêng cho Quản lý chi nhánh ──────────────────────
// Cung 1 nguon du lieu voi trang Co van (GET /dashboard/overview - BE da loc
// theo branch_id cua nguoi dang nhap nen luon la so lieu CA CHI NHANH, khong
// phai rieng cua 1 co van), nhung tach thanh trang/route rieng de sau nay
// tuy chinh cho quan ly ma khong anh huong man cua Co van, va them bo loc
// "Theo nam" ma trang Co van khong co.
export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState(`year:${CURRENT_YEAR}`);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const { fromDate, toDate } = computeDateRange(preset);
    getDashboardOverviewApi({ fromDate, toDate, status: status || undefined, categoryId: categoryId || undefined })
      .then((result) => { if (alive) setOverview(result); })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được dữ liệu dashboard'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [preset, status, categoryId, refreshKey]);

  const kpis = overview?.kpis || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, successRate: null };
  const monthlyTrend = overview?.monthlyTrend || [];
  const statusBreakdown = overview?.statusBreakdown || [];
  const repairCategoryMonthly = overview?.repairCategoryMonthly || [];
  const repairCategoryPerformance = overview?.repairCategoryPerformance || [];
  const topRepairCategory = repairCategoryPerformance[0];
  const categories = overview?.categories || [];

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h1>Dashboard chi nhánh</h1>
        <p>
          Vai trò: <strong>{user?.roleLabels?.join(', ') || user?.roles?.join(', ')}</strong>
          {user?.branchId && <span> · Chi nhánh #{user.branchId}</span>}
        </p>
      </div>

      <div className="dash-filterbar">
        <select className="form-select" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {DATE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{(STATUS_LABELS[s] || {}).label || s}</option>)}
        </select>
        <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>Làm mới</button>
        <div className="dash-filterbar__count">
          {loading ? 'Đang tải…' : `Đang hiển thị ${kpis.totalOrders} phiếu`}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#C62828' }}>
          {error}
        </div>
      )}

      <div className="dashboard__cards">
        <StatTile label="Tổng phiếu" value={kpis.totalOrders.toLocaleString('vi-VN')} />
        <StatTile label="Tổng doanh thu" value={formatCurrency(kpis.totalRevenue)} />
        <StatTile label="Giá trị TB / phiếu" value={formatCurrency(kpis.avgOrderValue)} />
        <StatTile label="Tỷ lệ thành công" value={kpis.successRate === null ? '—' : `${kpis.successRate}%`} />
      </div>

      <div className="dash-grid-3">
        <div className="dash-card dash-card--chart" style={{ gridColumn: 'span 2' }}>
          <div className="dash-card__title">Doanh thu theo tháng</div>
          {loading ? <div className="empty-state" style={{ minHeight: 220 }}><p>Đang tải…</p></div> : <RevenueLineChart data={monthlyTrend} />}
        </div>
        <div className="dash-card dash-card--chart">
          <div className="dash-card__title">Trạng thái phiếu</div>
          {loading ? <div className="empty-state" style={{ minHeight: 180 }}><p>Đang tải…</p></div> : <StatusDonutChart data={statusBreakdown} total={kpis.totalOrders} />}
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="dash-card dash-card--chart">
          <div className="dash-card__title">Số phiếu theo tháng &amp; trạng thái</div>
          {loading ? <div className="empty-state" style={{ minHeight: 220 }}><p>Đang tải…</p></div> : <StatusStackedBarChart data={monthlyTrend} />}
        </div>
        <div className="dash-card dash-card--chart">
          <div className="dash-card__title">Loại hình sửa chữa theo tháng</div>
          {loading ? <div className="empty-state" style={{ minHeight: 180 }}><p>Đang tải…</p></div> : <RepairCategoryStackedBarChart data={repairCategoryMonthly} topCategory={topRepairCategory} />}
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0 }}>
        <div className="dash-card__title" style={{ padding: '16px 20px 0' }}>Hiệu suất theo loại hình sửa chữa</div>
        <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Loại hình sửa chữa</th>
                <th>Số phiếu</th>
                <th>Doanh thu</th>
                <th>TB / phiếu</th>
                <th>Tỷ lệ thành công</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5}><div className="empty-state"><p>Đang tải…</p></div></td></tr>
              )}
              {!loading && repairCategoryPerformance.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <h3>Chưa có dữ liệu</h3>
                  </div>
                </td></tr>
              )}
              {!loading && repairCategoryPerformance.map((row) => (
                <tr key={row.repairCategory}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: REPAIR_CATEGORY_HUES[row.repairCategory], flexShrink: 0 }} />
                      {row.repairCategoryName}
                    </span>
                  </td>
                  <td>{row.orders}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(row.revenue)}</td>
                  <td>{formatCurrency(row.avgOrderValue)}</td>
                  <td>{row.successRate === null ? '—' : `${row.successRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
