import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AppContext';
import { getStockSummaryApi, getTopUsedPartsApi } from '../../services/inventoryApi';
import { formatCurrency } from '../../utils';
import { StatTile, BrandDonutChart, TopPartsBarChart } from './InventoryDashboardCharts';
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
  const { user } = useAuth();
  const branchId = user?.branchId;

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  const [period, setPeriod] = useState('month');
  const [partsStats, setPartsStats] = useState(null);
  const [partsLoading, setPartsLoading] = useState(true);
  const [partsError, setPartsError] = useState(null);

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
    getTopUsedPartsApi({ fromDate, toDate, limit: 10 })
      .then((res) => { if (mounted) setPartsStats(res); })
      .catch((err) => { if (mounted) setPartsError(err.message || 'Không tải được dữ liệu thống kê'); })
      .finally(() => { if (mounted) setPartsLoading(false); });
    return () => { mounted = false; };
  }, [branchId, period]);

  if (!branchId) {
    return (
      <div className="inv-dashboard__error">
        Tài khoản chưa được gán chi nhánh - liên hệ admin để được cập nhật.
      </div>
    );
  }

  const topParts = partsStats?.topParts || [];
  const topBrands = partsStats?.topBrands || [];
  const partsSummary = partsStats?.summary || {
    distinctParts: 0, totalExportQuantity: 0, totalExportCount: 0, totalDemandQuantity: 0, totalDemandCount: 0,
  };
  const topPart = topParts[0];

  return (
    <div className="inv-dashboard">
      <h1 className="inv-dashboard__title">Tổng quan kho</h1>
      <p className="inv-dashboard__subtitle">
        Số liệu tổng quan của chi nhánh bạn phụ trách.
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
        <div className="dash-filterbar__count">
          {partsLoading ? 'Đang tải…' : `${partsSummary.distinctParts} phụ tùng có phát sinh`}
        </div>
      </div>

      {partsError && (
        <div style={{ background: '#e4e4e7', border: '1px solid #a1a1aa', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#27272a' }}>
          {partsError}
        </div>
      )}

      <div className="dashboard__cards">
        <StatTile label="Tổng SL xuất kho" value={partsSummary.totalExportQuantity.toLocaleString('vi-VN')} />
        <StatTile label="Số lần xuất kho" value={partsSummary.totalExportCount.toLocaleString('vi-VN')} />
        <StatTile label="Tổng SL trên phiếu quyết toán" value={partsSummary.totalDemandQuantity.toLocaleString('vi-VN')} />
        <StatTile label="Số lượt dùng trên phiếu" value={partsSummary.totalDemandCount.toLocaleString('vi-VN')} />
      </div>

      <div className="dash-grid-2">
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
        <div className="dash-card dash-card--chart">
          <div className="dash-card__title">Phân bố theo hãng</div>
          {partsLoading ? <div className="empty-state" style={{ minHeight: 180 }}><p>Đang tải…</p></div> : <BrandDonutChart data={topBrands} />}
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0 }}>
        <div className="dash-card__title" style={{ padding: '16px 20px 0' }}>Chi tiết phụ tùng sử dụng nhiều nhất</div>
        <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã phụ tùng</th>
                <th>Tên phụ tùng</th>
                <th>Hãng</th>
                <th>SL xuất kho</th>
                <th>Số lần xuất</th>
                <th>SL trên phiếu QT</th>
                <th>Tồn hiện tại</th>
              </tr>
            </thead>
            <tbody>
              {partsLoading && (
                <tr><td colSpan={7}><div className="empty-state"><p>Đang tải…</p></div></td></tr>
              )}
              {!partsLoading && topParts.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <h3>Chưa có dữ liệu</h3>
                  </div>
                </td></tr>
              )}
              {!partsLoading && topParts.map((p) => (
                <tr key={p.productId}>
                  <td>{p.productCode}</td>
                  <td style={{ fontWeight: 600 }}>{p.productName}</td>
                  <td>{p.brandName || '—'}</td>
                  <td>{p.exportQuantity.toLocaleString('vi-VN')} {p.unit}</td>
                  <td>{p.exportCount.toLocaleString('vi-VN')}</td>
                  <td>{p.demandQuantity.toLocaleString('vi-VN')} {p.unit}</td>
                  <td>{p.currentStock.toLocaleString('vi-VN')} {p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
