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
        Tai khoan chua duoc gan chi nhanh - lien quan admin de duoc cap nhat.
      </div>
    );
  }

  return (
    <div className="inv-dashboard">
      <h1 className="inv-dashboard__title">Tong quan kho</h1>
      <p className="inv-dashboard__subtitle">
        So lieu tong quan cua chi nhanh ban phu trach.
      </p>

      {loading && <div className="inv-dashboard__loading">Dang tai...</div>}
      {error && <div className="inv-dashboard__error">Loi: {error}</div>}

      {summary && (
        <>
          <div className="inv-dashboard__cards">
            <div className="inv-card">
              <div className="inv-card__label">Tong so phu tung</div>
              <div className="inv-card__value">{summary.totalProducts ?? 0}</div>
            </div>
            <div className="inv-card">
              <div className="inv-card__label">Tong so luong ton</div>
              <div className="inv-card__value">{summary.totalQuantity ?? 0}</div>
            </div>
            <div className="inv-card">
              <div className="inv-card__label">Gia tri ton kho</div>
              <div className="inv-card__value">{formatVND(summary.totalValue)}</div>
            </div>
          </div>

          {summary.summary && summary.summary.length > 0 && (
            <div className="inv-dashboard__section">
              <h2 className="inv-dashboard__section-title">Phan bo theo loai</h2>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Loai</th>
                      <th className="text-right">So phu tung</th>
                      <th className="text-right">Tong SL ton</th>
                      <th className="text-right">Gia tri</th>
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
            <Link to="/inventory/parts" className="btn btn--primary">Quan ly phu tung</Link>
            <Link to="/inventory/stock" className="btn btn--ghost">Xem ton kho</Link>
            <Link to="/inventory/suppliers" className="btn btn--ghost">Nha cung cap</Link>
          </div>
        </>
      )}
    </div>
  );
}