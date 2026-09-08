import { Fragment, useEffect, useState } from 'react';
import { useInventoryBranch } from './InventoryLayout';
import { getStockSummaryApi, getTopUsedPartsApi } from '../../services/inventoryApi';
import { getProductsApi } from '../../services/productApi';
import { formatCurrency } from '../../utils';
import { StatTile, TopPartsBarChart } from './InventoryDashboardCharts';
import '../dashboard/DashboardPage.css';
import './DashboardPage.css';

// Cac moc thoi gian thong ke phu tung su dung nhieu nhat - "Tuan nay",
// "Thang nay", "Nam nay" theo lich duong (khong phai 7/30/365 ngay gan day).
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(now) {
  // Tuan bat dau tu Thu Hai (chuan VN).
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  const d = new Date(now);
  d.setDate(now.getDate() - diff);
  return d;
}

const PERIOD_PRESETS = [
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'year', label: 'Năm này' },
];

function computeDateRange(presetKey) {
  const now = new Date();
  if (presetKey === 'week') {
    return { fromDate: toISODate(startOfWeek(now)), toDate: toISODate(now) };
  }
  if (presetKey === 'year') {
    return { fromDate: toISODate(new Date(now.getFullYear(), 0, 1)), toDate: toISODate(now) };
  }
  // month (default)
  return { fromDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), toDate: toISODate(now) };
}

export default function DashboardPage() {
  const { branchId, loadingBranches, branchError } = useInventoryBranch();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  const [period, setPeriod] = useState('month');
  const [partsStats, setPartsStats] = useState(null);
  const [partsLoading, setPartsLoading] = useState(true);
  const [partsError, setPartsError] = useState(null);

  // Phu tung theo tung loai - chi tai khi mo rong dong tuong ung (lazy load,
  // cache lai theo category de bam lai khong goi lai API).
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [categoryParts, setCategoryParts] = useState({});
  const [categoryPartsLoading, setCategoryPartsLoading] = useState({});
  const [categoryPartsError, setCategoryPartsError] = useState({});

  useEffect(() => {
    if (!branchId) {
      setSummaryLoading(false);
      return;
    }
    let mounted = true;
    setSummaryLoading(true);
    getStockSummaryApi(branchId)
      .then((res) => { if (mounted) setSummary(res); })
      .catch((err) => { if (mounted) setSummaryError(err.message); })
      .finally(() => { if (mounted) setSummaryLoading(false); });
    return () => { mounted = false; };
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setPartsLoading(false);
      return;
    }
    let mounted = true;
    setPartsLoading(true);
    setPartsError(null);
    const { fromDate, toDate } = computeDateRange(period);
    getTopUsedPartsApi({ branchId, fromDate, toDate, limit: 10 })
      .then((res) => { if (mounted) setPartsStats(res); })
      .catch((err) => { if (mounted) setPartsError(err.message || 'Không tải được dữ liệu thống kê'); })
      .finally(() => { if (mounted) setPartsLoading(false); });
    return () => { mounted = false; };
  }, [branchId, period]);

  function toggleCategory(category) {
    if (expandedCategory === category) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(category);
    if (categoryParts[category] || categoryPartsLoading[category]) return;
    setCategoryPartsLoading((prev) => ({ ...prev, [category]: true }));
    setCategoryPartsError((prev) => ({ ...prev, [category]: null }));
    getProductsApi({ branchId, category, status: 'active', limit: 200 })
      .then((res) => {
        setCategoryParts((prev) => ({ ...prev, [category]: res.items || [] }));
      })
      .catch((err) => {
        setCategoryPartsError((prev) => ({ ...prev, [category]: err.message || 'Không tải được danh sách phụ tùng' }));
      })
      .finally(() => {
        setCategoryPartsLoading((prev) => ({ ...prev, [category]: false }));
      });
  }

  if (!branchId) {
    return (
      <div className="inv-dashboard__error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để xem dữ liệu kho.')}
      </div>
    );
  }

  const topParts = partsStats?.topParts || [];
  const partsSummary = partsStats?.summary || {
    distinctParts: 0, totalExportQuantity: 0, totalExportCount: 0, totalImportQuantity: 0, totalImportCount: 0,
  };
  const topPart = topParts[0];

  return (
    <div className="inv-dashboard">
      <h1 className="inv-dashboard__title">Tổng quan kho</h1>
      <p className="inv-dashboard__subtitle">
        Số liệu tổng quan của chi nhánh đang được chọn trong module kho.
      </p>

      {summaryLoading && <div className="inv-dashboard__loading">Đang tải...</div>}
      {summaryError && <div className="inv-dashboard__error">Lỗi: {summaryError}</div>}

      {summary && (
        <div className="inv-dashboard__cards">
          <div className="inv-card">
            <div className="inv-card__label">Tổng số phụ tùng</div>
            <div className="inv-card__value">{summary.totalProducts ?? 0}</div>
          </div>
          <div className="inv-card">
            <div className="inv-card__label">Tổng số lượng tồn</div>
            <div className="inv-card__value">{summary.totalQuantity ?? 0}</div>
          </div>
          <div className="inv-card">
            <div className="inv-card__label">Giá trị tồn kho</div>
            <div className="inv-card__value">{formatCurrency(summary.totalValue)}</div>
          </div>
        </div>
      )}

      <div className="dash-filterbar" style={{ marginTop: 28 }}>
        <h2 className="inv-dashboard__section-title" style={{ marginBottom: 0, marginRight: 8 }}>Phụ tùng được sử dụng nhiều nhất</h2>
        <select className="form-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIOD_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {partsError && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#C62828' }}>
          {partsError}
        </div>
      )}

      <div className="dashboard__cards">
        <StatTile label="Tổng SL xuất kho" value={partsSummary.totalExportQuantity.toLocaleString('vi-VN')} />
        <StatTile label="Số lần xuất kho" value={partsSummary.totalExportCount.toLocaleString('vi-VN')} />
        <StatTile label="Tổng SL nhập kho" value={partsSummary.totalImportQuantity.toLocaleString('vi-VN')} />
        <StatTile label="Số lần nhập kho" value={partsSummary.totalImportCount.toLocaleString('vi-VN')} />
      </div>

      <div className="dash-card dash-card--chart">
        <div className="dash-card__title">Top 10 phụ tùng sử dụng nhiều nhất</div>
        {topPart && topPart.totalQuantity > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--gray-700)', marginBottom: 10 }}>
            Được sử dụng nhiều nhất:{' '}
            <b>{topPart.productName}</b>{' '}({topPart.totalQuantity.toLocaleString('vi-VN')} {topPart.unit})
          </div>
        )}
        {partsLoading ? <div className="empty-state" style={{ minHeight: 220 }}><p>Đang tải…</p></div> : <TopPartsBarChart data={topParts} />}
      </div>

      {summary && summary.summary && summary.summary.length > 0 && (
        <div className="dash-card" style={{ padding: 0 }}>
          <div className="dash-card__title" style={{ padding: '16px 20px 0' }}>Tổng hợp theo loại</div>
          <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Số phụ tùng</th>
                  <th>Tổng SL tồn</th>
                  <th>Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {summary.summary.map((c) => {
                  const isOpen = expandedCategory === c.category;
                  const parts = categoryParts[c.category];
                  const loadingParts = categoryPartsLoading[c.category];
                  const partsError = categoryPartsError[c.category];
                  return (
                    <Fragment key={c.category}>
                      <tr
                        onClick={() => toggleCategory(c.category)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 14, color: 'var(--gray-500)' }}>{isOpen ? '▾' : '▸'}</span>
                          {c.category}
                        </td>
                        <td>{c.productCount}</td>
                        <td>{c.totalQuantity}</td>
                        <td>{formatCurrency(c.totalValue)}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={4} style={{ padding: 0, background: 'var(--gray-50, #f8fafc)' }}>
                            {loadingParts && (
                              <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--gray-600)' }}>Đang tải…</div>
                            )}
                            {partsError && (
                              <div style={{ padding: '12px 20px', fontSize: 13, color: '#C62828' }}>{partsError}</div>
                            )}
                            {!loadingParts && !partsError && parts && parts.length === 0 && (
                              <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--gray-600)' }}>Không có phụ tùng nào</div>
                            )}
                            {!loadingParts && !partsError && parts && parts.length > 0 && (
                              <table className="data-table" style={{ margin: '0 20px 12px', width: 'calc(100% - 40px)' }}>
                                <thead>
                                  <tr>
                                    <th>Mã</th>
                                    <th>Tên</th>
                                    <th>Số lượng</th>
                                    <th>Tổng giá trị</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parts.map((p) => (
                                    <tr key={p.id}>
                                      <td>{p.productCode}</td>
                                      <td>{p.productName}</td>
                                      <td>{p.stockQuantity}</td>
                                      <td>{formatCurrency((p.stockQuantity || 0) * (p.unitPrice || 0))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
