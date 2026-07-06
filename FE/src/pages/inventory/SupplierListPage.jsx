import { useState } from 'react';
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
  const {
    suppliers, loading, error,
    params, setSearch, setStatus, applyFilters,
    create, update, remove,
  } = useSuppliers();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  function emptyForm() {
    return {
      supplierCode: '',
      supplierName: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      taxCode: '',
      status: 'active',
      note: '',
    };
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setShowModal(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({ ...s });
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (editing) {
        await update(editing.id, form);
      } else {
        await create(form);
      }
      closeModal();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Xac nhan xoa nha cung cap nay?')) return;
    setDeletingId(id);
    try {
      await remove(id);
    } finally {
      setDeletingId(null);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') applyFilters();
  }

  return (
    <div className="sup-list">
      <div className="sup-list__header">
        <div>
          <h1 className="sup-list__title">Danh sach nha cung cap</h1>
          <p className="sup-list__subtitle">Quan ly thong tin nha cung cap phu tung</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Them nha cung cap
        </button>
      </div>

      {/* Filters */}
      <div className="sup-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tim theo ma, ten nha cung cap..."
          value={params.search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <select
          className="input input--select"
          value={params.status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tat ca trang thai</option>
          <option value="active">Hoat dong</option>
          <option value="inactive">Tam ngung</option>
        </select>
        <button className="btn btn--secondary" onClick={applyFilters}>Loc</button>
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
                <th style={{ width: 140 }}>Hanh dong</th>
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
                    <td>{s.contactName}</td>
                    <td>{s.phone}</td>
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
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(s)}>
                        Sua
                      </button>
                      <button
                        className="btn btn--ghost btn--sm btn--danger"
                        onClick={() => handleDelete(s.id)}
                        disabled={deletingId === s.id}
                      >
                        Xoa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">{editing ? 'Sua nha cung cap' : 'Them nha cung cap'}</h2>
              <button className="modal__close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal__body">
              {formError && <div className="form-error">{formError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ma NCC <span className="required">*</span></label>
                  <input
                    className="input"
                    value={form.supplierCode}
                    onChange={(e) => setForm({ ...form, supplierCode: e.target.value })}
                    required
                    placeholder="VD: SUP-006"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ten NCC <span className="required">*</span></label>
                  <input
                    className="input"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                    required
                    placeholder="VD: Cong ty Phu tung A"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nguoi lien he</label>
                  <input
                    className="input"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="Ho va ten"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">So dien thoai</label>
                  <input
                    className="input"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="09x..."
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ma so thue</label>
                  <input
                    className="input"
                    value={form.taxCode}
                    onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                    placeholder="Ma so thue"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dia chi</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Dia chi day du"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trang thai</label>
                  <select
                    className="input input--select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">Hoat dong</option>
                    <option value="inactive">Tam ngung</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Ghi chu</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Ghi chu them..."
                />
              </div>

              <div className="modal__footer">
                <button type="button" className="btn btn--secondary" onClick={closeModal}>
                  Huy
                </button>
                <button type="submit" className="btn btn--primary">
                  {editing ? 'Luu thay doi' : 'Tao moi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
