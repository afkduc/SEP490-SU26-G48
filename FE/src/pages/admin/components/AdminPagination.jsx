import './AdminPagination.css';

/**
 * Pagination dùng chung cho các trang admin.
 * Props:
 *  - currentPage, totalPages, total, onChange, loading
 *  - accent: 'cyan' | 'indigo' (màu nút active)
 */
export default function AdminPagination({
  currentPage,
  totalPages,
  total,
  onChange,
  loading,
  accent = 'cyan',
}) {
  if (!total || total === 0) return null;

  function handlePageChange(page) {
    if (page < 1 || page > totalPages || loading || page === currentPage) return;
    onChange(page);
  }

  const pages = (() => {
    const out = [];
    const len = Math.min(totalPages, 7);
    for (let i = 0; i < len; i += 1) {
      if (totalPages <= 7) out.push(i + 1);
      else if (currentPage <= 4) out.push(i + 1);
      else if (currentPage >= totalPages - 3) out.push(totalPages - 6 + i);
      else out.push(currentPage - 3 + i);
    }
    return out;
  })();

  return (
    <div className="admin-pagination">
      <span className="admin-pagination__info">
        Tổng <strong>{total}</strong> bản ghi
        &nbsp;— Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
      </span>
      <div className="admin-pagination__controls">
        <button
          type="button"
          className="admin-pagination__nav-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Trước
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`admin-pagination__page-btn admin-pagination--${accent} ${p === currentPage ? 'active' : ''}`}
            onClick={() => handlePageChange(p)}
            disabled={loading}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="admin-pagination__nav-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
        >
          Sau
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
