import './AdminPagination.css';

/**
 * Pagination dùng chung cho các trang admin.
 * Props:
 *  - currentPage, totalPages, total, onChange, loading
 *  - accent: 'cyan' | 'indigo' (màu nút active)
 *  - siblingCount: số trang hiển thị 2 bên trang hiện tại (mặc định 1)
 *
 * Desktop:
 *   << < Prev 1 2 3 4 > Next >>
 *
 * Mobile (responsive):
 *   < Trang 2 / 15 > (Previous | 2/15 | Next)
 */
export default function AdminPagination({
  currentPage,
  totalPages,
  total,
  onChange,
  loading,
  accent = 'cyan',
  siblingCount = 1,
}) {
  if (!total || total === 0) return null;

  function handlePageChange(page) {
    if (page < 1 || page > totalPages || loading || page === currentPage) return;
    onChange(page);
  }

  // Build pagination range với first / ... / left-siblings / current / right-siblings / ... / last
  const paginationRange = (() => {
    const totalNumbers = siblingCount * 2 + 5; // first + last + current + 2*siblings + 2 dots
    if (totalPages <= totalNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSibling = Math.max(currentPage - siblingCount, 1);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages);
    const showLeftDots = leftSibling > 2;
    const showRightDots = rightSibling < totalPages - 1;

    if (!showLeftDots && showRightDots) {
      const leftCount = 3 + 2 * siblingCount;
      return [...Array.from({ length: leftCount }, (_, i) => i + 1), 'dots-right', totalPages];
    }
    if (showLeftDots && !showRightDots) {
      const rightCount = 3 + 2 * siblingCount;
      return [1, 'dots-left', ...Array.from({ length: rightCount }, (_, i) => totalPages - rightCount + 1 + i)];
    }
    return [
      1,
      'dots-left',
      ...Array.from({ length: 2 * siblingCount + 1 }, (_, i) => leftSibling + i),
      'dots-right',
      totalPages,
    ];
  })();

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <div className="admin-pagination">
      <span className="admin-pagination__info admin-pagination__info--desktop">
        Tổng <strong>{total}</strong> bản ghi
        &nbsp;— Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
      </span>
      <span className="admin-pagination__info admin-pagination__info--mobile">
        <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
      </span>

      <div className="admin-pagination__controls admin-pagination__controls--desktop">
        {/* « First */}
        <button
          type="button"
          className="admin-pagination__nav-btn admin-pagination__edge-btn"
          onClick={() => handlePageChange(1)}
          disabled={isFirst || loading}
          title="Trang đầu"
          aria-label="Trang đầu"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>

        {/* ‹ Trước */}
        <button
          type="button"
          className="admin-pagination__nav-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={isFirst || loading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Trước
        </button>

        {/* Pages + dots */}
        {paginationRange.map((p, idx) => {
          if (p === 'dots-left' || p === 'dots-right') {
            return (
              <span
                key={`${p}-${idx}`}
                className="admin-pagination__dots"
                aria-hidden="true"
              >
                …
              </span>
            );
          }
          return (
            <button
              key={p}
              type="button"
              className={`admin-pagination__page-btn admin-pagination--${accent} ${p === currentPage ? 'active' : ''}`}
              onClick={() => handlePageChange(p)}
              disabled={loading}
            >
              {p}
            </button>
          );
        })}

        {/* Tiếp › */}
        <button
          type="button"
          className="admin-pagination__nav-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={isLast || loading}
        >
          Sau
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Last » */}
        <button
          type="button"
          className="admin-pagination__nav-btn admin-pagination__edge-btn"
          onClick={() => handlePageChange(totalPages)}
          disabled={isLast || loading}
          title="Trang cuối"
          aria-label="Trang cuối"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </svg>
        </button>
      </div>

      <div className="admin-pagination__controls admin-pagination__controls--mobile">
        <button
          type="button"
          className="admin-pagination__mobile-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={isFirst || loading}
          aria-label="Trang trước"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Trước
        </button>
        <button
          type="button"
          className="admin-pagination__mobile-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={isLast || loading}
          aria-label="Trang sau"
        >
          Sau
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
