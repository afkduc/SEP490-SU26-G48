import { useAuth } from '../../contexts/AppContext';
import { useStock } from '../../hooks/inventory/useStock';
import { formatCurrency } from '../../utils';

// ─── Trang Kho riêng cho Quản lý - liệt kê từng phụ tùng ───────────────
// Dung lai hook useStock (da co san, dang dung chung o StockPage cho Nhan
// vien kho) - chi lam giao dien rieng theo dung style cac man Quan ly, khong
// doi gi ben BE/hook.
export default function ManagerInventoryPage() {
  const { user } = useAuth();
  const {
    stockList, categories, loading, error,
    params, setSearch, setCategory, setPage,
  } = useStock(user?.branchId);

  const totalPages = Math.max(1, Math.ceil(stockList.total / stockList.limit));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Kho phụ tùng</h1>
          <div className="breadcrumb">Trang chủ / Kho</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon">🔍</span>
          <input value={params.search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã, tên phụ tùng..." />
        </div>
        <select className="filter-select" value={params.category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: '#e4e4e7', border: '1px solid #a1a1aa', color: '#27272a', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã PT</th>
              <th>Tên phụ tùng</th>
              <th>Danh mục</th>
              <th>Số lượng</th>
              <th>Giá trị</th>
              <th>Tổng giá trị</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6}><div className="empty-state"><p>Đang tải…</p></div></td></tr>
            )}
            {!loading && stockList.items.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <h3>Chưa có dữ liệu</h3>
                </div>
              </td></tr>
            )}
            {!loading && stockList.items.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace' }}>{p.productCode ?? p.partCode}</td>
                <td style={{ fontWeight: 600 }}>{p.productName ?? p.partName}</td>
                <td>{p.category || '—'}</td>
                <td>{p.stockQuantity}</td>
                <td>{formatCurrency(p.unitPrice)}</td>
                <td style={{ fontWeight: 700 }}>{formatCurrency((p.stockQuantity || 0) * (p.unitPrice || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stockList.total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: 'var(--gray-500)' }}>
          <div>Tổng {stockList.total} phụ tùng</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" disabled={params.page <= 1} onClick={() => setPage(params.page - 1)}>Trước</button>
            <span>Trang {params.page}/{totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={params.page >= totalPages} onClick={() => setPage(params.page + 1)}>Sau</button>
          </div>
        </div>
      )}
    </div>
  );
}
