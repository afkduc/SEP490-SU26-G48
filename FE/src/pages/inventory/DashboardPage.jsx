import { useEffect, useState } from 'react';
import { getStockSummaryApi } from '../../services/inventoryMockApi';
import './DashboardPage.css';

function formatVND(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getStockSummaryApi()
      .then((res) => {
        if (mounted) setSummary(res.data);
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
  }, []);

  return (
    <div className="inv-dashboard">
      <h1 className="inv-dashboard__title">Tong quan kho</h1>
      <p className="inv-dashboard__subtitle">
        Day la trang tong quan cua module Kho. So lieu se duoc cap nhat sau khi noi API that.
      </p>

      {loading && <div className="inv-dashboard__loading">Dang tai...</div>}
      {error && <div className="inv-dashboard__error">Loi: {error}</div>}

      {summary && (
        <div className="inv-dashboard__cards">
          <div className="inv-card">
            <div className="inv-card__label">Tong phu tung</div>
            <div className="inv-card__value">{summary.totalParts}</div>
          </div>
          <div className="inv-card">
            <div className="inv-card__label">Gia tri ton kho</div>
            <div className="inv-card__value">{formatVND(summary.totalStockValue)}</div>
          </div>
          <div className="inv-card inv-card--warning">
            <div className="inv-card__label">Sap het hang</div>
            <div className="inv-card__value">{summary.lowStockCount}</div>
          </div>
          <div className="inv-card inv-card--danger">
            <div className="inv-card__label">Het hang</div>
            <div className="inv-card__value">{summary.outOfStockCount}</div>
          </div>
        </div>
      )}
    </div>
  );
}
