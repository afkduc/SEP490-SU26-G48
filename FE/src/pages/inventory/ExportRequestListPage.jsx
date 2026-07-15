import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useExportRequests } from '../../hooks/inventory/useExportRequests';
import './ExportRequestListPage.css';

const STATUS_META = {
  completed: { label: 'Da xuat', className: 'badge--success' },
  cancelled: { label: 'Huy', className: 'badge--danger' },
};

const STATUS_TABS = [
  { value: '', label: 'Tat ca' },
  { value: 'completed', label: 'Da xuat' },
  { value: 'cancelled', label: 'Huy' },
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

export default function ExportRequestListPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    requests, total, page, limit, loading, error,
    params,
    setStatus, setFromDate, setToDate, setSearch, setPage,
  } = useExportRequests(branchId);

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
    <div className="er-list">
      <div className="er-list__header">
        <div>
          <h1 className="er-list__title">Phieu xuat kho</h1>
          <p className="er-list__subtitle">
            Xuat phu tung theo phieu sua chua (Service Order). NV kho tu xuat - khong can Manager duyet.
          </p>
        </div>
        <Link to="/inventory/export-requests/new" className="btn btn--primary">
          + Tao phieu xuat
        </Link>
      </div>

      {/* Tabs theo status */}
      <div className="er-list__tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`er-list__tab${params.status === tab.value ? ' er-list__tab--active' : ''}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="er-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tim theo ma phieu, ma phieu sua chua, ghi chu..."
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          className="input"
          type="date"
          value={draftFromDate}
          onChange={(e) => setDraftFromDate(e.target.value)}
          title="Tu ngay"
        />
        <input
          className="input"
          type="date"
          value={draftToDate}
          onChange={(e) => setDraftToDate(e.target.value)}
          title="Den ngay"
        />
        <button type="button" className="btn btn--secondary" onClick={handleApplyFilter}>
          Loc
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="er-list__loading">Dang tai...</div>
      ) : error ? (
        <div className="er-list__error">Loi: {error}</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Ma phieu</th>
                <th>Ngay tao</th>
                <th>Ngay xuat</th>
                <th>Phieu sua chua</th>
                <th>Khach hang</th>
                <th>So dong</th>
                <th>Tong SL</th>
                <th>Trang thai</th>
                <th>Nguoi xuat</th>
                <th style={{ width: 110 }}>Hanh dong</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table__empty">
                    Khong co phieu xuat nao
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const meta = STATUS_META[r.status] || { label: r.status, className: '' };
                  return (
                    <tr key={r.id}>
                      <td><span className="font-mono">{r.requestCode}</span></td>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td>{formatDate(r.exportDate)}</td>
                      <td><span className="font-mono">{r.serviceOrderCode || '—'}</span></td>
                      <td>{r.customerName || '—'}</td>
                      <td className="text-right">{r.itemCount ?? 0}</td>
                      <td className="text-right">{r.totalQuantity ?? 0}</td>
                      <td>
                        <span className={`badge ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td>{r.performedByName || '—'}</td>
                      <td className="table__actions">
                        <Link
                          to={`/inventory/export-requests/${r.id}`}
                          className="btn btn--ghost btn--sm"
                        >
                          Chi tiet
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
            Tong: <strong>{total}</strong> phieu
          </span>
          <div className="er-list__pagination-controls">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &laquo; Truoc
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