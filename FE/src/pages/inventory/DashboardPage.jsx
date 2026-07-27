import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { getStockSummaryApi } from '../../services/inventoryApi';
import './DashboardPage.css';

function formatVND(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    getStockSummaryApi(branchId)
      .then((res) => {
        if (mounted) setSummary(res);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [branchId]);

  if (!branchId) {
    return (
      <div className="inv-dashboard__error">
        Tài khoản chưa được gán chi nhánh - liên hệ admin để được cập nhật.
      </div>
    );
  }

  return (
    <div className="inv-dashboard">
      <h1 className="inv-dashboard__title">Tổng quan kho</h1>
      <p className="inv-dashboard__subtitle">
        Số liệu tổng quan của chi nhánh bạn phụ trách.
      </p>

      {loading && <div className="inv-dashboard__loading">Đang tải...</div>}
      {error && <div className="inv-dashboard__error">Lỗi: {error}</div>}

      {summary && (
        <>
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
              <div className="inv-card__value">{formatVND(summary.totalValue)}</div>
            </div>
          </div>

          {summary.summary && summary.summary.length > 0 && (
            <div className="inv-dashboard__section">
              <h2 className="inv-dashboard__section-title">Phân bố theo loại</h2>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Loại</th>
                      <th className="text-right">Số phụ tùng</th>
                      <th className="text-right">Tổng SL tồn</th>
                      <th className="text-right">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.summary.map((c) => (
                      <tr key={c.category}>
                        <td>{c.category}</td>
                        <td className="text-right">{c.productCount}</td>
                        <td className="text-right">{c.totalQuantity}</td>
                        <td className="text-right">{formatVND(c.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="inv-dashboard__quicklinks">
            <Link to="/inventory/parts" className="btn btn--primary">Quản lý phụ tùng</Link>
            <Link to="/inventory/stock" className="btn btn--ghost">Xem tồn kho</Link>
            <Link to="/inventory/suppliers" className="btn btn--ghost">Nhà cung cấp</Link>
          </div>
        </>
      )}
    </div>
  );
}