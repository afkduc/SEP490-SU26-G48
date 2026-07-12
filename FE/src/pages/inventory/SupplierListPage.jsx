import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSuppliers } from '../../hooks/inventory/useSuppliers';
import './SupplierListPage.css';

const STATUS_LABELS = {
  active: 'Hoat dong',
  inactive: 'Tam ngung',
};

const STATUS_CLASS = {
  active: 'badge--success',
  inactive: 'badge--danger',
};

export default function SupplierListPage() {
  const { suppliers, loading, error, params, setSearch, setStatus, applyFilters } =
    useSuppliers();

  // Local filter draft (de user bam Enter / Loc moi goi API).
  const [draftSearch, setDraftSearch] = useState(params.search);
  const [draftStatus, setDraftStatus] = useState(params.status);

  useEffect(() => {
    setDraftSearch(params.search);
  }, [params.search]);
  useEffect(() => {
    setDraftStatus(params.status);
  }, [params.status]);

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      setSearch(draftSearch);
      setStatus(draftStatus);
      applyFilters();
    }
  }

  function handleApply() {
    setSearch(draftSearch);
    setStatus(draftStatus);
    applyFilters();
  }

  return (
    <div className="sup-list">
      <div className="sup-list__header">
        <div>
          <h1 className="sup-list__title">Danh sach nha cung cap</h1>
          <p className="sup-list__subtitle">
            Thong tin cac nha cung cap phu tung (chi xem, khong sua/xoa o man hinh nay)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="sup-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tim theo ma, ten, SDT..."
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <select
          className="input input--select"
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
        >
          <option value="">Tat ca trang thai</option>
          <option value="active">Hoat dong</option>
          <option value="inactive">Tam ngung</option>
        </select>
        <button className="btn btn--secondary" onClick={handleApply}>Loc</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="sup-list__loading">Dang tai...</div>
      ) : error ? (
        <div className="sup-list__error">Loi: {error}</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Ma NCC</th>
                <th>Ten nha cung cap</th>
                <th>Nguoi lien he</th>
                <th>DT</th>
                <th>Email</th>
                <th>Trang thai</th>
                <th style={{ width: 110 }}>Hanh dong</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table__empty">
                    Khong co nha cung cap nao
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><span className="font-mono">{s.supplierCode}</span></td>
                    <td>{s.supplierName}</td>
                    <td>{s.contactName || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[s.status] || ''}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="table__actions">
                      <Link to={`/inventory/suppliers/${s.id}`} className="btn btn--ghost btn--sm">
                        Chi tiet
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}