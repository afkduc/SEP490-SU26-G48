import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PermissionGate } from '../../components/PermissionGate';
import { useInventoryBranch } from './InventoryLayout';
import { useImportRequests } from '../../hooks/inventory/useImportRequests';
import './ImportRequestListPage.css';

const STATUS_META = {
  pending: { label: 'Chờ duyệt (phiếu cũ)', className: 'badge--warning' },
  approved: { label: 'Đã nhập kho', className: 'badge--success' },
  rejected: { label: 'Từ chối', className: 'badge--danger' },
};

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt (phiếu cũ)' },
  { value: 'approved', label: 'Đã nhập kho' },
  { value: 'rejected', label: 'Từ chối' },
];

function formatDate(d) {
  if (!d) return '—';
  return String(d).slice(0, 10);
}

function formatDateTime(d) {
  if (!d) return '—';
  const s = String(d);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

export default function ImportRequestListPage() {
  const { branchId, loadingBranches, branchError } = useInventoryBranch();

  const {
    requests, total, page, limit, loading, error,
    params,
    setStatus, setFromDate, setToDate, setSearch, setPage,
  } = useImportRequests(branchId);

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

  if (!branchId) {
    return (
      <div className="ir-list__error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để xem phiếu nhập.')}
      </div>
    );
  }

  return (
    <div className="ir-list">
      <div className="ir-list__header">
        <div>
          <h1 className="ir-list__title">Phiếu nhập kho</h1>
          <p className="ir-list__subtitle">
            Phiếu nhập mới sẽ cộng tồn kho ngay sau khi tạo; chỉ các phiếu cũ ở trạng thái pending mới cần duyệt.
          </p>
        </div>
        <PermissionGate permission="import_requests:create">
          <Link to="/inventory/import-requests/new" className="btn btn--primary">
            + Tạo phiếu nhập
          </Link>
        </PermissionGate>
      </div>

      {/* Tabs theo status */}
      <div className="ir-list__tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`ir-list__tab${params.status === tab.value ? ' ir-list__tab--active' : ''}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="ir-list__filters">
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

      {/* Table */}
      {loading ? (
        <div className="ir-list__loading">Đang tải...</div>
      ) : error ? (
        <div className="ir-list__error">Lỗi: {error}</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Ngày tạo</th>
                <th>Ngày nhập</th>
                <th>Nhà cung cấp</th>
                <th>Số dòng</th>
                <th>Tổng SL</th>
                <th>Trạng thái</th>
                <th>Người tạo</th>
                <th style={{ width: 110 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table__empty">
                    Không có phiếu nhập nào
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const meta = STATUS_META[r.status] || { label: r.status, className: '' };
                  return (
                    <tr key={r.id}>
                      <td><span className="font-mono">{r.requestCode}</span></td>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td>{formatDate(r.importDate)}</td>
                      <td>{r.supplierName || '—'}</td>
                      <td className="text-right">{r.itemCount ?? 0}</td>
                      <td className="text-right">{r.totalQuantity ?? 0}</td>
                      <td>
                        <span className={`badge ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td>{r.requestedByName || '—'}</td>
                      <td className="table__actions">
                        <Link
                          to={`/inventory/import-requests/${r.id}`}
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

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="ir-list__pagination">
          <span className="ir-list__pagination-info">
            Tổng: <strong>{total}</strong> phiếu
          </span>
          <div className="ir-list__pagination-controls">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &laquo; Trước
            </button>
            <span className="ir-list__pagination-current">
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