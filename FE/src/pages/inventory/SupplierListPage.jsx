import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSuppliers } from '../../hooks/inventory/useSuppliers';
import './SupplierListPage.css';

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Tạm ngừng',
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
          <h1 className="sup-list__title">Danh sách nhà cung cấp</h1>
          <p className="sup-list__subtitle">
            Thông tin các nhà cung cấp phụ tùng (chỉ xem, không sửa/xóa ở màn hình này)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="sup-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tìm theo mã, tên, SDT..."
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <select
          className="input input--select"
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Tạm ngừng</option>
        </select>
        <button className="btn btn--secondary" onClick={handleApply}>Lọc</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="sup-list__loading">Đang tải...</div>
      ) : error ? (
        <div className="sup-list__error">Lỗi: {error}</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Mã NCC</th>
                <th>Tên nhà cung cấp</th>
                <th>Người liên hệ</th>
                <th>ĐT</th>
                <th>Email</th>
                <th>Trạng thái</th>
                <th style={{ width: 110 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table__empty">
                    Không có nhà cung cấp nào
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
                        Chi tiết
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