import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useManagerExportRequests } from '../../hooks/manager/useManagerExportRequests';
import './ManagerExportRequestListPage.css';

function formatDateTime(d) {
  if (!d) return '—';
  const s = String(d);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

function addYears(dateStr, years) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export default function ManagerExportRequestListPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    requests, total, page, limit, loading, error,
    params,
    setFromDate, setToDate, setSearch, setPage,
  } = useManagerExportRequests(branchId);

  const [draftSearch, setDraftSearch] = useState(params.search);
  const [draftFromDate, setDraftFromDate] = useState(params.fromDate);
  const [draftToDate, setDraftToDate] = useState(params.toDate);

  useEffect(() => { setDraftSearch(params.search); }, [params.search]);
  useEffect(() => { setDraftFromDate(params.fromDate); }, [params.fromDate]);
  useEffect(() => { setDraftToDate(params.toDate); }, [params.toDate]);

  // "Đến ngày" phải >= "Từ ngày" (khong duoc som hon moc bat dau) va toi da
  // cach "Từ ngày" 2 nam - doi lai "Từ ngày" ma "Đến ngày" dang chon khong
  // con hop le trong khoang do thi tu xoa "Đến ngày" di.
  const toDateMin = draftFromDate || undefined;
  const toDateMax = draftFromDate ? addYears(draftFromDate, 2) : undefined;

  useEffect(() => {
    if (!draftFromDate || !draftToDate) return;
    if (draftToDate < draftFromDate || draftToDate > addYears(draftFromDate, 2)) {
      setDraftToDate('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFromDate]);

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
          min={toDateMin}
          max={toDateMax}
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
                <th style={{ width: 90 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table__empty">
                    Không có phiếu xuất nào trong chi nhánh của bạn
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  return (
                    <tr key={r.id}>
                      <td>
                        {r.isNewForManager && (
                          <span
                            title="Phiếu mới"
                            style={{
                              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                              background: '#DC2626', marginRight: 6,
                            }}
                          />
                        )}
                        <span className="font-mono">{r.requestCode}</span>
                      </td>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td><span className="font-mono">{r.repairOrderCode || '—'}</span></td>
                      <td>{r.customerName || '—'}</td>
                      <td className="text-right">{r.itemCount ?? 0}</td>
                      <td className="text-right">{r.totalQuantity ?? 0}</td>
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
