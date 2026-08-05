import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PermissionGate } from '../../components/PermissionGate';
import { useInventoryBranch } from './InventoryLayout';
import { useExportRequests } from '../../hooks/inventory/useExportRequests';
import './ExportRequestListPage.css';

const STATUS_META = {
  completed: { label: 'Đã xuất', className: 'badge--success' },
};

function formatDateTime(d) {
  if (!d) return '—';
  const s = String(d);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

export default function ExportRequestListPage() {
  const { branchId, loadingBranches, branchError } = useInventoryBranch();

  const {
    requests, total, page, limit, loading, error,
    params,
    setFromDate, setToDate, setSearch, setPage,
  } = useExportRequests(branchId);

  const [draftSearch, setDraftSearch] = useState(params.search);
  const [draftFromDate, setDraftFromDate] = useState(params.fromDate);
  const [draftToDate, setDraftToDate] = useState(params.toDate);
  const [filterError, setFilterError] = useState('');

  useEffect(() => { setDraftSearch(params.search); }, [params.search]);
  useEffect(() => { setDraftFromDate(params.fromDate); }, [params.fromDate]);
  useEffect(() => { setDraftToDate(params.toDate); }, [params.toDate]);

  function handleApplyFilter() {
    if (draftFromDate && draftToDate && draftFromDate > draftToDate) {
      setFilterError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }
    setFilterError('');
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
      <div className="er-list__error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để xem phiếu xuất.')}
      </div>
    );
  }

  return (
    <div className="er-list">
      <div className="er-list__header">
        <div>
          <h1 className="er-list__title">Phiếu xuất kho</h1>
          <p className="er-list__subtitle">
            Xuất phụ tùng theo phiếu sửa chữa (Service Order). NV kho tự xuất - không cần Manager duyệt.
          </p>
        </div>
        <PermissionGate permission="export_requests:create">
          <Link to="/inventory/export-requests/new" className="btn btn--primary">
            + Tạo phiếu xuất
          </Link>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="er-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tìm theo mã phiếu, mã phiếu sửa chữa"
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          className="input"
          type="date"
          value={draftFromDate}
          onChange={(e) => setDraftFromDate(e.target.value)}
          max={draftToDate || undefined}
          title="Từ ngày"
        />
        <input
          className="input"
          type="date"
          value={draftToDate}
          onChange={(e) => setDraftToDate(e.target.value)}
          min={draftFromDate || undefined}
          title="Đến ngày"
        />
        <button type="button" className="btn btn--secondary" onClick={handleApplyFilter}>
          Lọc
        </button>
      </div>
      {filterError && <div className="er-list__error">{filterError}</div>}

      {/* Table */}
      {loading ? (
        <div className="er-list__loading">Đang tải...</div>
      ) : error ? (
        <div className="er-list__error">Lỗi: {error}</div>
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
                <th style={{ width: 110 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table__empty">
                    Không có phiếu xuất nào
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
                          to={`/inventory/export-requests/${r.id}`}
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
        <div className="er-list__pagination">
          <span className="er-list__pagination-info">
            Tổng: <strong>{total}</strong> phiếu
          </span>
          <div className="er-list__pagination-controls">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &laquo; Trước
            </button>
            <span className="er-list__pagination-current">
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
