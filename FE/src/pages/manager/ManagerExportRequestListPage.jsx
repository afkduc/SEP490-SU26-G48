import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useManagerExportRequests } from '../../hooks/manager/useManagerExportRequests';
import './ManagerExportRequestListPage.css';

const STATUS_META = {
  completed: { label: 'Đã xuất', className: 'badge--success' },
  cancelled: { label: 'Hủy', className: 'badge--danger' },
};

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'completed', label: 'Đã xuất' },
  { value: 'cancelled', label: 'Hủy' },
];

function formatDateTime(d) {
  if (!d) return '—';
  const s = String(d);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

export default function ManagerExportRequestListPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    requests, total, page, limit, loading, error,
    params,
    setStatus, setFromDate, setToDate, setSearch, setPage,
  } = useManagerExportRequests(branchId);

  const [draftSearch, setDraftSearch] = useState(params.search);
  const [draftFromDate, setDraftFromDate] = useState(params.fromDate);
  const [draftToDate, setDraftToDate] = useState(params.toDate);

  useEffect(() => { setDraftSearch(params.search); }, [params.search]);
  useEffect(() => { setDraftFromDate(params.fromDate); }, [params.fromDate]);
  useEffect(() => { setDraftToDate(params.toDate); }, [params.toDate]);

  function handleApplyFilter() {
    setSearch(draftSearch);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleApplyFilter();
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mer-list">
      <div className="mer-list__header">
        <div>
          <h1 className="mer-list__title">Phiếu xuất kho</h1>
          <p className="mer-list__subtitle">
            Xem lịch sử xuất kho của chi nhánh bạn quản lý. NV kho tự xuất trực tiếp
            theo phiếu sửa chữa - không cần Manager duyệt.
          </p>
        </div>
      </div>

      <div className="mer-list__tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`mer-list__tab${params.status === tab.value ? ' mer-list__tab--active' : ''}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mer-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tìm theo mã phiếu, mã phiếu sửa chữa, ghi chú..."
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          className="input"
          type="date"
          value={draftFromDate}
          onChange={(e) => setDraftFromDate(e.target.value)}
          title="Từ ngày"
        />
        <input
          className="input"
          type="date"
          value={draftToDate}
          onChange={(e) => setDraftToDate(e.target.value)}
          title="Đến ngày"
        />
        <button type="button" className="btn btn--secondary" onClick={handleApplyFilter}>
          Lọc
        </button>
      </div>

      {loading ? (
        <div className="mer-list__loading">Đang tải...</div>
      ) : error ? (
        <div className="mer-list__error">Lỗi: {error}</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Ngày tạo</th>
                <th>Phiếu sửa chữa</th>
                <th>Khách hàng</th>
                <th>Số dòng</th>
                <th>Tổng SL</th>
                <th>Trạng thái</th>
                <th style={{ width: 90 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table__empty">
                    Không có phiếu xuất nào trong chi nhánh của bạn
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const meta = STATUS_META[r.status] || { label: r.status, className: '' };
                  return (
                    <tr key={r.id}>
                      <td><span className="font-mono">{r.requestCode}</span></td>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td><span className="font-mono">{r.serviceOrderCode || '—'}</span></td>
                      <td>{r.customerName || '—'}</td>
                      <td className="text-right">{r.itemCount ?? 0}</td>
                      <td className="text-right">{r.totalQuantity ?? 0}</td>
                      <td>
                        <span className={`badge ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td className="table__actions">
                        <Link
                          to={`/manager/export-requests/${r.id}`}
                          className="btn btn--ghost btn--sm"
                        >
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="mer-list__pagination">
          <span className="mer-list__pagination-info">
            Tổng: <strong>{total}</strong> phiếu
          </span>
          <div className="mer-list__pagination-controls">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &laquo; Trước
            </button>
            <span className="mer-list__pagination-current">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Sau &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
