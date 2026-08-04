import { Link } from 'react-router-dom';
import { useInventoryBranch } from './InventoryLayout';
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
  const { branchId, loadingBranches, branchError } = useInventoryBranch();
  const {
    stockList, lowStock, summary, loading, error, categories,
    params, setSearch, setCategory, setLowStockOnly, setPage, refetch,
  } = useStock(branchId);

  if (!branchId) {
    return (
      <div className="stock-page__error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để xem tồn kho.')}
      </div>
    );
  }

  if (loading && !stockList.items.length) {
    return <div className="stock-page__loading">Đang tải dữ liệu tồn kho...</div>;
  }
  if (error) {
    return <div className="stock-page__error">Lỗi: {error}</div>;
  }

  const totalPages = Math.max(1, Math.ceil(stockList.total / stockList.limit));

  return (
    <div className="stock-page">
      <div className="stock-page__header">
        <div>
          <h1 className="stock-page__title">Tồn kho</h1>
          <p className="stock-page__subtitle">
            Quản lý số lượng tồn kho và cảnh báo sắp hết hàng theo chi nhánh.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={refetch}>Làm mới</button>
      </div>

      {/* KPI cards */}
      <div className="stock-page__kpis">
        <div className="kpi-card">
          <div className="kpi-card__label">Tổng số phụ tùng</div>
          <div className="kpi-card__value">{summary.totalProducts}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Tổng số lượng tồn</div>
          <div className="kpi-card__value">{summary.totalQuantity}</div>
        </div>
        <div className="kpi-card kpi-card--accent">
          <div className="kpi-card__label">Giá trị tồn kho</div>
          <div className="kpi-card__value">{formatVND(summary.totalValue)}</div>
        </div>
        <div className="kpi-card kpi-card--warn">
          <div className="kpi-card__label">Sắp hết hàng</div>
          <div className="kpi-card__value">{lowStock.length}</div>
        </div>
      </div>

      {/* Cảnh báo sắp hết hàng */}
      {lowStock.length > 0 && (
        <div className="stock-alert">
          <h2 className="stock-alert__title">⚠ Cảnh báo tồn kho thấp</h2>
          <p className="stock-alert__desc">
            Có {lowStock.length} phụ tùng đang ở mức sắp hết ({'<= '} tồn tối thiểu). Cần nhập thêm hàng.
          </p>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã PT</th>
                  <th>Tên phụ tùng</th>
                  <th>SL tồn</th>
                  <th>Tồn tối thiểu</th>
                  <th>Thiếu</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td><span className="font-mono">{p.productCode ?? p.partCode}</span></td>
                    <td>
                      <Link to={`/inventory/parts/${p.id}`}>{p.productName ?? p.partName}</Link>
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

      {/* Tổng hợp theo loại */}
      {summary.summary.length > 0 && (
        <div className="stock-summary">
          <h2 className="stock-summary__title">Tổng hợp theo loại</h2>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Số phụ tùng</th>
                  <th>Tổng SL tồn</th>
                  <th>Giá trị</th>
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

      {/* Danh sách tồn kho + filter */}
      <div className="stock-list">
        <h2 className="stock-list__title">Danh sách tồn kho</h2>

        <div className="stock-list__filters">
          <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo mã, tên phụ tùng..."
            value={params.search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input input--select"
            value={params.category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Tất cả loại</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <label className="filter-low-stock">
            <input
              type="checkbox"
              checked={params.lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            Sắp hết
          </label>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Mã PT</th>
                <th>Tên phụ tùng</th>
                <th>Loại</th>
                <th>Đơn vị</th>
                <th>SL tồn</th>
                <th>Tồn tối thiểu</th>
                <th>Trạng thái</th>
                <th>Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {stockList.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table__empty">Không có dữ liệu tồn kho</td>
                </tr>
              ) : (
                stockList.items.map((p) => {
                  const isLow = p.stockQuantity <= p.minStock;
                  return (
                    <tr key={p.id} className={isLow ? 'row--low-stock' : ''}>
                      <td><span className="font-mono">{p.productCode ?? p.partCode}</span></td>
                      <td>
                        <Link to={`/inventory/parts/${p.id}`}>{p.productName ?? p.partName}</Link>
                      </td>
                      <td>{p.category || '—'}</td>
                      <td>{p.unitName || '—'}</td>
                      <td className={`text-right ${isLow ? 'text-danger' : 'text-success'}`}>
                        {p.stockQuantity}
                      </td>
                      <td className="text-right">{p.minStock}</td>
                      <td>
                        <span className={`badge ${isLow ? 'badge--warning' : 'badge--success'}`}>
                          {isLow ? 'Sắp hết' : 'Còn hàng'}
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
                ← Trước
              </button>
              <span className="stock-list__page-info">
                Trang {params.page} / {totalPages} (tổng {stockList.total})
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