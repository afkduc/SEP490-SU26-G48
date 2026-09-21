import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AppContext';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { getDashboardOverviewApi, getRepairCategoryServicesApi } from '../../services/dashboardApi';
import managerApi from '../../services/managerApi';
import { formatCurrency, formatDate, toLocalISODate } from '../../utils';
import { STATUS_LABELS } from '../repairsettlement/mockData';
import {
  REPAIR_CATEGORY_ORDER, REPAIR_CATEGORY_LABELS, REPAIR_CATEGORY_HUES,
  StatTile, RevenueLineChart, RepairCategoryStackedBarChart,
} from '../dashboard/DashboardCharts';
import SettlementDetailModal, { settlementStatusBadge } from './SettlementDetailModal';
import '../dashboard/DashboardPage.css';

const CURRENT_YEAR = new Date().getFullYear();
// Ngoai cac khoang co san (giong trang Co van), them rieng lua chon "Theo
// nam" - quan ly can xem doanh thu ca nam de doi chieu voi ke hoach/bao cao
// theo nam, khong chi xem theo khoang gan day.
// Bo loc trang thai cua quan ly chi co 2 trang thai KET THUC (da xuat hoa don /
// da huy), khong co "tat ca" - cac trang thai dang lam (cho sua, dang sua, cho
// thanh toan) la viec van hanh hang ngay cua co van/to truong, khong phai thu
// quan ly can xem o dashboard. Mac dinh = phan tu dau (da xuat hoa don).
const FILTER_STATUSES = ['invoiced', 'cancelled'];

// Khong co "Thang nay": bieu do doanh thu theo thang chi co 1 diem, khong ve
// duoc xu huong - "3 thang gan day" da bao gom thang hien tai.
const DATE_PRESETS = [
  { key: 'all', label: 'Tất cả thời gian' },
  { key: '3m', label: '3 tháng gần đây' },
  { key: '6m', label: '6 tháng gần đây' },
  { key: `year:${CURRENT_YEAR}`, label: `Năm ${CURRENT_YEAR}` },
  { key: `year:${CURRENT_YEAR - 1}`, label: `Năm ${CURRENT_YEAR - 1}` },
  { key: `year:${CURRENT_YEAR - 2}`, label: `Năm ${CURRENT_YEAR - 2}` },
];

// Ngay theo gio may (xem toLocalISODate) - truoc day dung toISOString() nen
// tu 0h-7h sang "Thang nay" ket thuc o HOM QUA, phieu tiep nhan trong ngay
// khong duoc tinh vao Tong phieu / Doanh thu du modal chi tiet van liet ke.
const toISODate = toLocalISODate;

function computeDateRange(presetKey) {
  if (presetKey.startsWith('year:')) {
    const year = Number(presetKey.split(':')[1]);
    return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
  }
  const now = new Date();
  // "N thang gan day" = N thang LICH tinh ca thang hien tai -> ket thuc o CUOI
  // thang nay, khong phai hom nay: bieu do/modal deu gom theo thang, neu cat o
  // hom nay thi phieu tiep nhan sau thoi diem nay trong thang (vd gio may lech)
  // se co trong modal thang do ma khong co trong so lieu.
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (presetKey === '3m') {
    return { fromDate: toISODate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), toDate: toISODate(endOfMonth) };
  }
  if (presetKey === '6m') {
    return { fromDate: toISODate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), toDate: toISODate(endOfMonth) };
  }
  return { fromDate: '', toDate: '' };
}

// Danh sach thang { month: 'YYYY-MM', label: 'MM/YYYY' } cua khoang thoi gian
// dang chon - cho dropdown loc thang o bang "Hieu suat theo loai hinh".
function listMonthOptions(presetKey, monthlyTrend) {
  const item = (y, m0) => ({
    month: `${y}-${String(m0 + 1).padStart(2, '0')}`,
    label: `${String(m0 + 1).padStart(2, '0')}/${y}`,
  });
  if (presetKey.startsWith('year:')) {
    const year = Number(presetKey.split(':')[1]);
    return Array.from({ length: 12 }, (_, i) => item(year, i));
  }
  const n = presetKey === '3m' ? 3 : presetKey === '6m' ? 6 : 0;
  if (n) {
    const now = new Date();
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (n - 1) + i, 1);
      return item(d.getFullYear(), d.getMonth());
    });
  }
  // "Tat ca thoi gian": khong co bien -> lay nhung thang co du lieu
  return monthlyTrend.map((m) => ({ month: m.month, label: m.label }));
}

// Dong bang "Hieu suat theo loai hinh" cua 1 thang, tinh tu repairCategoryMonthly
// (BE tra so phieu + doanh thu theo thang x loai hinh) - cung dang/thu tu voi
// repairCategoryPerformance (nhieu phieu nhat len dau, chi loai co phieu).
function rowsForMonth(bucket) {
  if (!bucket) return [];
  return REPAIR_CATEGORY_ORDER
    .filter((cat) => (bucket.byCategory?.[cat] || 0) > 0)
    .map((cat) => ({
      repairCategory: cat,
      repairCategoryName: REPAIR_CATEGORY_LABELS[cat] || cat,
      orders: bucket.byCategory[cat],
      revenue: bucket.byCategoryRevenue?.[cat] || 0,
    }))
    .sort((a, b) => b.orders - a.orders);
}

// Cac loai su kien SSE (/sse/repair-orders) anh huong so lieu Dashboard:
// phieu moi tao, hoan thanh (cho thanh toan), thanh toan xong (xuat hoa
// don), hoac bi huy. Bo qua cac event khac (claimed, task-updated,
// bay-occupied...) vi khong doi status/total cua repair_orders.
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

// Modal danh sach phieu cua 1 thang THEO TRANG THAI dang chon o bo loc (da xuat
// hoa don / da huy) - mo khi bam vao 1 diem tren bieu do "Doanh thu theo tháng".
// Loc theo intakeDate (khong phai paidAt) vi bieu do doanh thu cua BE cung gom
// theo intake_date (xem DashboardRepositoryImpl.getOverview - trendResult
// GROUP BY thang cua intake_date), nen phai loc dung nhung phieu da tinh vao
// dung con so tren bieu do. Table/cot giong het SettlementReportsPage - "Xem
// chi tiết" mo lai SettlementDetailModal dung chung.
function MonthSettlementsModal({ month, monthLabel, status, onClose }) {
  const statusLabel = ((STATUS_LABELS[status] || {}).label || status).toLowerCase();
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

  const filtered = reports.filter((r) => r.status === status && monthKeyOf(r.intakeDate) === month);

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
          <h3 className="modal-title">Phiếu {statusLabel} · Tháng {monthLabel}</h3>
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
                      <h3>Không có phiếu {statusLabel} trong tháng này</h3>
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

// Modal "dich vu da dung" cua 1 loai hinh sua chua - mo khi bam 1 dong o bang
// "Hieu suat theo loai hinh". Voi PM (goi bao duong) liet ke cac GOI, loai
// khac liet ke dich vu le. rangeLabel/fromDate/toDate/status = dung pham vi
// dang xem o bang (ke ca thang dang loc) de so phieu khop cot "So phieu".
function RepairCategoryServicesModal({ category, categoryName, rangeLabel, fromDate, toDate, status, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isPackage = category === 'PM';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getRepairCategoryServicesApi(category, { fromDate, toDate, status })
      .then((data) => { if (alive) setRows(data || []); })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được danh sách dịch vụ'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [category, fromDate, toDate, status]);

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: REPAIR_CATEGORY_HUES[category], flexShrink: 0 }} />
              {categoryName}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
              {isPackage ? 'Gói bảo dưỡng' : 'Dịch vụ'} đã sử dụng · {rangeLabel}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflow: 'auto' }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div className="table-wrapper" style={{ boxShadow: 'none', marginBottom: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>{isPackage ? 'Gói bảo dưỡng' : 'Dịch vụ'}</th>
                  <th>Số lần sử dụng</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={3}><div className="empty-state"><p>Đang tải…</p></div></td></tr>
                )}
                {!loading && rows.length === 0 && !error && (
                  <tr><td colSpan={3}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>Không có {isPackage ? 'gói' : 'dịch vụ'} nào trong khoảng này</h3>
                    </div>
                  </td></tr>
                )}
                {!loading && rows.map((r) => (
                  <tr key={r.key}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{r.code || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{r.name || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && rows.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-500)' }}>
              {rows.length} {isPackage ? 'gói' : 'dịch vụ'} · tổng {totalQty} lần sử dụng
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [status, setStatus] = useState(FILTER_STATUSES[0]);
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
    // status luon la 1 trong FILTER_STATUSES - khong co lua chon "tat ca".
    getDashboardOverviewApi({ fromDate, toDate, status })
      .then((result) => { if (alive) setOverview(result); })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được dữ liệu dashboard'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [preset, status, refreshKey]);

  // Tu dong lam moi Dashboard (khong can F5) khi co thay doi anh huong so
  // lieu - dung chung kenh SSE /sse/repair-orders (da scope san theo branchId
  // cua nguoi dang nhap) voi trang Quyet toan sua chua.
  const handleRepairOrderEvent = useCallback((event) => {
    if (!DASHBOARD_RELEVANT_EVENTS.has(event?.type)) return;
    setRefreshKey((k) => k + 1);
  }, []);
  useRepairOrderEventsSSE(handleRepairOrderEvent, true);

  const kpis = overview?.kpis || { totalOrders: 0, totalRevenue: 0 };
  const monthlyTrend = overview?.monthlyTrend || [];
  const repairCategoryMonthly = overview?.repairCategoryMonthly || [];
  const repairCategoryPerformance = overview?.repairCategoryPerformance || [];
  const topRepairCategory = repairCategoryPerformance[0];

  // Bang "Hieu suat theo loai hinh": loc them theo 1 THANG trong khoang dang
  // chon o tren ('' = ca khoang). Danh sach thang an theo bo loc thoi gian:
  // 3/6 thang gan day -> dung 3/6 thang lich; theo nam -> 12 thang; "tat ca
  // thoi gian" -> nhung thang co du lieu. Doi bo loc tren thi ve lai ca khoang.
  const [perfMonth, setPerfMonth] = useState('');
  useEffect(() => { setPerfMonth(''); }, [preset]);
  const perfMonthOptions = listMonthOptions(preset, monthlyTrend);
  const perfRows = perfMonth
    ? rowsForMonth(repairCategoryMonthly.find((m) => m.month === perfMonth))
    : repairCategoryPerformance;

  // Bam 1 dong loai hinh -> modal dich vu/goi da dung, dung pham vi dang xem
  // o bang: thang dang loc (ca thang) hoac ca khoang cua bo loc thoi gian.
  const [drillCategory, setDrillCategory] = useState(null);
  const perfRange = (() => {
    if (perfMonth) {
      const [y, m] = perfMonth.split('-').map(Number);
      return {
        fromDate: toISODate(new Date(y, m - 1, 1)),
        toDate: toISODate(new Date(y, m, 0)),
        label: `Tháng ${perfMonthOptions.find((o) => o.month === perfMonth)?.label || perfMonth}`,
      };
    }
    const { fromDate, toDate } = computeDateRange(preset);
    return { fromDate, toDate, label: DATE_PRESETS.find((p) => p.key === preset)?.label || '' };
  })();

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
          {FILTER_STATUSES.map((s) => <option key={s} value={s}>{(STATUS_LABELS[s] || {}).label || s}</option>)}
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
      </div>

      <div className="dash-grid-3">
        <div className="dash-card dash-card--chart" style={{ gridColumn: 'span 2' }}>
          {/* Phieu huy khong co doanh thu -> loc "Da huy" thi ve SO PHIEU huy theo
              thang (ve tien se la duong thang 0, khong noi len gi). */}
          <div className="dash-card__title">{status === 'cancelled' ? 'Số phiếu đã hủy theo tháng' : 'Doanh thu theo tháng'}</div>
          {loading ? <div className="empty-state" style={{ minHeight: 220 }}><p>Đang tải…</p></div> : (
            <RevenueLineChart
              data={monthlyTrend}
              valueKey={status === 'cancelled' ? 'totalOrders' : 'totalRevenue'}
              onPointClick={(p) => setSelectedMonth({ month: p.month, label: p.label })}
              clickHint={`Bấm để xem danh sách phiếu ${((STATUS_LABELS[status] || {}).label || status).toLowerCase()}`}
            />
          )}
        </div>
        {/* Khong co bieu do "Trang thai phieu" / "So phieu theo thang & trang
            thai": bo loc cua quan ly luon chon dung 1 trang thai nen 2 bieu do
            do chi con 1 mau, khong noi len gi. */}
        <div className="dash-card dash-card--chart">
          <div className="dash-card__title">Loại hình sửa chữa theo tháng</div>
          {loading ? <div className="empty-state" style={{ minHeight: 180 }}><p>Đang tải…</p></div> : <RepairCategoryStackedBarChart data={repairCategoryMonthly} topCategory={topRepairCategory} />}
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '16px 20px 0' }}>
          <div className="dash-card__title" style={{ marginBottom: 0 }}>Hiệu suất theo loại hình sửa chữa</div>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 160 }}
            value={perfMonth}
            onChange={(e) => setPerfMonth(e.target.value)}
            aria-label="Lọc theo tháng"
          >
            <option value="">{DATE_PRESETS.find((p) => p.key === preset)?.label || 'Cả khoảng'}</option>
            {perfMonthOptions.map((m) => <option key={m.month} value={m.month}>Tháng {m.label}</option>)}
          </select>
        </div>
        <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Loại hình sửa chữa</th>
                <th>Số phiếu</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3}><div className="empty-state"><p>Đang tải…</p></div></td></tr>
              )}
              {!loading && perfRows.length === 0 && (
                <tr><td colSpan={3}>
                  <div className="empty-state">
                    <h3>{perfMonth ? 'Không có phiếu nào trong tháng này' : 'Chưa có dữ liệu'}</h3>
                  </div>
                </td></tr>
              )}
              {!loading && perfRows.map((row) => (
                <tr
                  key={row.repairCategory}
                  onClick={() => setDrillCategory(row)}
                  title={`Xem ${row.repairCategory === 'PM' ? 'gói bảo dưỡng' : 'dịch vụ'} đã dùng`}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--primary-dark)' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: REPAIR_CATEGORY_HUES[row.repairCategory], flexShrink: 0 }} />
                      {row.repairCategoryName}
                      <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500 }}>›</span>
                    </span>
                  </td>
                  <td>{row.orders}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMonth && (
        <MonthSettlementsModal
          month={selectedMonth.month}
          monthLabel={selectedMonth.label}
          status={status}
          onClose={() => setSelectedMonth(null)}
        />
      )}
      {drillCategory && (
        <RepairCategoryServicesModal
          category={drillCategory.repairCategory}
          categoryName={drillCategory.repairCategoryName}
          rangeLabel={`${perfRange.label} · ${(STATUS_LABELS[status] || {}).label || status}`}
          fromDate={perfRange.fromDate}
          toDate={perfRange.toDate}
          status={status}
          onClose={() => setDrillCategory(null)}
        />
      )}
    </div>
  );
}
