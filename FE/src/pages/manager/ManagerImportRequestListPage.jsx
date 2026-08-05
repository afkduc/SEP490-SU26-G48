import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useManagerImportRequests } from '../../hooks/manager/useManagerImportRequests';
import './ManagerImportRequestListPage.css';

const STATUS_META = {
  pending: { label: 'Chờ duyệt', className: 'badge--warning' },
  approved: { label: 'Đã duyệt', className: 'badge--success' },
  rejected: { label: 'Từ chối', className: 'badge--danger' },
};

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
];

function formatDateTime(d) {
  if (!d) return '—';
  const s = String(d);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

export default function ManagerImportRequestListPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    requests, total, page, limit, loading, error,
    params,
    setStatus, setFromDate, setToDate, setSearch, setPage,
  } = useManagerImportRequests(branchId);

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
    <div className="mir-list">
      <div className="mir-list__header">
        <div>
          <h1 className="mir-list__title">Phiếu nhập kho</h1>
          <p className="mir-list__subtitle">
            Xem và duyệt các phiếu nhập phụ tùng từ nhà cung cấp của chi nhánh bạn quản lý.
            Khi duyệt thành công, hệ thống sẽ cộng tồn kho và ghi log giao dịch.
          </p>
        </div>
      </div>

      <div className="mir-list__tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`mir-list__tab${params.status === tab.value ? ' mir-list__tab--active' : ''}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mir-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tìm theo mã phiếu, ghi chú..."
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
        <div className="mir-list__loading">Đang tải...</div>
      ) : error ? (
        <div className="mir-list__error">Lỗi: {error}</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Ngày tạo</th>
                <th>Nhà cung cấp</th>
                <th>Số dòng</th>
                <th>Tổng SL</th>
                <th>Trạng thái</th>
                <th style={{ width: 110 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table__empty">
                    Không có phiếu nhập nào trong chi nhánh của bạn
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const meta = STATUS_META[r.status] || { label: r.status, className: '' };
                  return (
                    <tr key={r.id}>
                      <td><span className="font-mono">{r.requestCode}</span></td>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td>{r.supplierName || '—'}</td>
                      <td className="text-right">{r.itemCount ?? 0}</td>
                      <td className="text-right">{r.totalQuantity ?? 0}</td>
                      <td>
                        <span className={`badge ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td className="table__actions">
                        <Link
                          to={`/manager/import-requests/${r.id}`}
                          className="btn btn--ghost btn--sm"
                        >
                          {r.status === 'pending' ? 'Duyệt' : 'Xem'}
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
        <div className="mir-list__pagination">
          <span className="mir-list__pagination-info">
            Tổng: <strong>{total}</strong> phiếu
          </span>
          <div className="mir-list__pagination-controls">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &laquo; Trước
            </button>
            <span className="mir-list__pagination-current">
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
