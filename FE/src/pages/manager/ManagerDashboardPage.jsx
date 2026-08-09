import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AppContext';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { getDashboardOverviewApi } from '../../services/dashboardApi';
import managerApi from '../../services/managerApi';
import { formatCurrency, formatDate } from '../../utils';
import { STATUS_LABELS } from '../repairsettlement/mockData';
import {
  STATUS_ORDER, REPAIR_CATEGORY_HUES,
  StatTile, RevenueLineChart, StatusStackedBarChart, StatusDonutChart, RepairCategoryStackedBarChart,
} from '../dashboard/DashboardCharts';
import SettlementDetailModal, { settlementStatusBadge } from './SettlementDetailModal';
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

// Cac loai su kien SSE (/sse/repair-orders) anh huong so lieu Dashboard:
// phieu moi tao, hoan thanh (cho thanh toan), thanh toan xong (xuat hoa
// don), hoac bi huy. Bo qua cac event khac (claimed, task-updated,
// bay-occupied...) vi khong doi status/total cua service_orders.
const DASHBOARD_RELEVANT_EVENTS = new Set([
  'new-pending', 'order-completed', 'invoiced', 'order-cancelled',
]);

// 'YYYY-MM' - phai khop dinh dang voi monthKey() trong DashboardRepositoryImpl.js
// (BE) de doi chieu dung voi field "month" cua tung diem tren RevenueLineChart.
function monthKeyOf(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Modal danh sach phieu DA THANH TOAN cua 1 thang - mo khi bam vao 1 diem tren
// bieu do "Doanh thu theo tháng". Loc theo intakeDate (khong phai paidAt) vi
// bieu do doanh thu cua BE cung gom theo intake_date (xem DashboardRepositoryImpl
// .getOverview - trendResult GROUP BY thang cua intake_date), nen phai loc
// dung nhung phieu da tinh vao dung con so tren bieu do. Table/cot giong het
// tab "Đã xuất hóa đơn" cua SettlementReportsPage - "Xem chi tiết" mo lai
// SettlementDetailModal dung chung.
function MonthPaidSettlementsModal({ month, monthLabel, onClose }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    managerApi
      .getSettlementReports({})
      .then((data) => { if (alive) setReports(data || []); })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được danh sách phiếu quyết toán'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = reports.filter((r) => r.status === 'invoiced' && monthKeyOf(r.intakeDate) === month);

  const openDetail = (report) => {
    setActiveReport(report);
    setDetailError('');
    setDetailLoading(true);
    managerApi
      .getSettlementReportById(report.id)
      .then((data) => setActiveReport(data || report))
      .catch((err) => setDetailError(err.message || 'Không tải được chi tiết phiếu quyết toán'))
      .finally(() => setDetailLoading(false));
  };

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 1100 }}>
        <div className="modal-header">
          <h3 className="modal-title">Phiếu đã thanh toán · Tháng {monthLabel}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '80vh', overflow: 'auto' }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div className="table-wrapper" style={{ boxShadow: 'none', marginBottom: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Xe</th>
                  <th>Khách hàng</th>
                  <th>Tư vấn</th>
                  <th>Tiếp nhận</th>
                  <th>Hoàn thành</th>
                  <th>Chi phí</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">⏳</div>
                      <h3>Đang tải danh sách phiếu quyết toán</h3>
                    </div>
                  </td></tr>
                )}

                {!loading && filtered.length === 0 && !error && (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>Không có phiếu đã thanh toán trong tháng này</h3>
                    </div>
                  </td></tr>
                )}

                {!loading && filtered.map((report) => {
                  const badge = settlementStatusBadge(report.status);
                  return (
                    <tr key={report.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-dark)' }}>{report.code}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{report.vehicle?.licensePlate || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                          {report.vehicle?.vehicleModel || '—'}{report.vehicle?.manufactureYear ? ` · ${report.vehicle.manufactureYear}` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{report.customer?.fullName || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{report.customer?.phone || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{report.advisor?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{report.advisor?.phone || ''}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{formatDate(report.intakeDate)}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(report.completedDate)}</td>
                      <td style={{ fontWeight: 800, color: '#C62828' }}>{formatCurrency(report.total)}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: badge.background, color: badge.color, fontSize: 12, fontWeight: 800 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-info btn-sm" onClick={() => openDetail(report)}>Xem chi tiết</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-500)' }}>{filtered.length} phiếu</div>
          )}

          {detailError && (
            <div style={{ marginTop: 12, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', borderRadius: 10, padding: '12px 14px' }}>
              {detailError}
            </div>
          )}
          {detailLoading && (
            <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', borderRadius: 10, padding: '12px 14px' }}>
              Đang tải chi tiết phiếu quyết toán...
            </div>
          )}
        </div>
      </div>
    </div>

    {!detailLoading && activeReport && (
      <SettlementDetailModal report={activeReport} onClose={() => setActiveReport(null)} />
    )}
    </>
  );
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
  const [selectedMonth, setSelectedMonth] = useState(null);

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

  // Tu dong lam moi Dashboard (khong can F5) khi co thay doi anh huong so
  // lieu - dung chung kenh SSE /sse/repair-orders (da scope san theo branchId
  // cua nguoi dang nhap) voi trang Quyet toan sua chua.
  const handleRepairOrderEvent = useCallback((event) => {
    if (!DASHBOARD_RELEVANT_EVENTS.has(event?.type)) return;
    setRefreshKey((k) => k + 1);
  }, []);
  useRepairOrderEventsSSE(handleRepairOrderEvent, true);

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
          {loading ? <div className="empty-state" style={{ minHeight: 220 }}><p>Đang tải…</p></div> : (
            <RevenueLineChart
              data={monthlyTrend}
              onPointClick={(p) => setSelectedMonth({ month: p.month, label: p.label })}
            />
          )}
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

      {selectedMonth && (
        <MonthPaidSettlementsModal
          month={selectedMonth.month}
          monthLabel={selectedMonth.label}
          onClose={() => setSelectedMonth(null)}
        />
      )}
    </div>
  );
}
