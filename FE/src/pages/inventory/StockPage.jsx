import { Link } from 'react-router-dom';
import { useStock } from '../../hooks/inventory/useStock';
import './StockPage.css';

function formatVND(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function StockPage() {
  const {
    stockList, lowStock, summary, loading, error,
    params, setSearch, setCategory, setLowStockOnly, setPage, refetch,
  } = useStock();

  if (loading && !stockList.items.length) {
    return <div className="stock-page__loading">Dang tai du lieu ton kho...</div>;
  }
  if (error) {
    return <div className="stock-page__error">Loi: {error}</div>;
  }

  const totalPages = Math.max(1, Math.ceil(stockList.total / stockList.limit));

  return (
    <div className="stock-page">
      <div className="stock-page__header">
        <div>
          <h1 className="stock-page__title">Ton kho</h1>
          <p className="stock-page__subtitle">
            Quan ly so luong ton kho va canh bao sap het hang theo chi nhanh.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={refetch}>Lam moi</button>
      </div>

      {/* KPI cards */}
      <div className="stock-page__kpis">
        <div className="kpi-card">
          <div className="kpi-card__label">Tong so phu tung</div>
          <div className="kpi-card__value">{summary.totalProducts}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Tong so luong ton</div>
          <div className="kpi-card__value">{summary.totalQuantity}</div>
        </div>
        <div className="kpi-card kpi-card--accent">
          <div className="kpi-card__label">Gia tri ton kho</div>
          <div className="kpi-card__value">{formatVND(summary.totalValue)}</div>
        </div>
        <div className="kpi-card kpi-card--warn">
          <div className="kpi-card__label">Sap het hang</div>
          <div className="kpi-card__value">{lowStock.length}</div>
        </div>
      </div>

      {/* Canh bao sap het hang */}
      {lowStock.length > 0 && (
        <div className="stock-alert">
          <h2 className="stock-alert__title">⚠ Canh bao ton kho thap</h2>
          <p className="stock-alert__desc">
            Co {lowStock.length} phu tung dang o muc sap het ({'<= '} ton toi thieu). Can nhap them hang.
          </p>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Ma PT</th>
                  <th>Ten phu tung</th>
                  <th>SL ton</th>
                  <th>Ton toi thieu</th>
                  <th>Thieu</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td><span className="font-mono">{p.partCode}</span></td>
                    <td>
                      <Link to={`/inventory/parts/${p.id}`}>{p.partName}</Link>
                    </td>
                    <td className="text-right text-danger">{p.stockQuantity}</td>
                    <td className="text-right">{p.minStock}</td>
                    <td className="text-right text-danger">{p.stockQuantity - p.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tong hop theo category */}
      {summary.summary.length > 0 && (
        <div className="stock-summary">
          <h2 className="stock-summary__title">Tong hop theo loai</h2>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Loai</th>
                  <th>So phu tung</th>
                  <th>Tong SL ton</th>
                  <th>Gia tri</th>
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

      {/* Danh sach ton kho + filter */}
      <div className="stock-list">
        <h2 className="stock-list__title">Danh sach ton kho</h2>

        <div className="stock-list__filters">
          <input
            className="input input--search"
            type="text"
            placeholder="Tim theo ma, ten phu tung..."
            value={params.search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input input--select"
            value={params.category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Tat ca loai</option>
            <option value="Phu tung dong co">Phu tung dong co</option>
            <option value="Phu tung gam">Phu tung gam</option>
            <option value="Phu tung dien">Phu tung dien</option>
            <option value="Dau nhot & hoa chat">Dau nhot & hoa chat</option>
            <option value="Phu kien">Phu kien</option>
          </select>
          <label className="filter-low-stock">
            <input
              type="checkbox"
              checked={params.lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            Sap het
          </label>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Ma PT</th>
                <th>Ten phu tung</th>
                <th>Loai</th>
                <th>Don vi</th>
                <th>SL ton</th>
                <th>Ton toi thieu</th>
                <th>Trang thai</th>
                <th>Gia tri</th>
              </tr>
            </thead>
            <tbody>
              {stockList.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table__empty">Khong co du lieu ton kho</td>
                </tr>
              ) : (
                stockList.items.map((p) => {
                  const isLow = p.stockQuantity <= p.minStock;
                  return (
                    <tr key={p.id} className={isLow ? 'row--low-stock' : ''}>
                      <td><span className="font-mono">{p.partCode}</span></td>
                      <td>
                        <Link to={`/inventory/parts/${p.id}`}>{p.partName}</Link>
                      </td>
                      <td>{p.category || '—'}</td>
                      <td>{p.unit || '—'}</td>
                      <td className={`text-right ${isLow ? 'text-danger' : 'text-success'}`}>
                        {p.stockQuantity}
                      </td>
                      <td className="text-right">{p.minStock}</td>
                      <td>
                        <span className={`badge ${isLow ? 'badge--warning' : 'badge--success'}`}>
                          {isLow ? 'Sap het' : 'Con hang'}
                        </span>
                      </td>
                      <td className="text-right">
                        {formatVND((p.stockQuantity || 0) * (p.unitPrice || 0))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="stock-list__pagination">
            <button
              className="btn btn--ghost btn--sm"
              disabled={params.page <= 1}
              onClick={() => setPage(params.page - 1)}
            >
              ← Truoc
            </button>
            <span className="stock-list__page-info">
              Trang {params.page} / {totalPages} (tong {stockList.total})
            </span>
            <button
              className="btn btn--ghost btn--sm"
              disabled={params.page >= totalPages}
              onClick={() => setPage(params.page + 1)}
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}