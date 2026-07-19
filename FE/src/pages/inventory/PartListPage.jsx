import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useParts } from '../../hooks/inventory/useParts';
import { listUnitsApi } from '../../services/productApi';
import './PartListPage.css';

const STATUS_LABELS = {
  active: 'Hoat dong',
  low_stock: 'Sap het',
  inactive: 'Tam ngung',
};

const STATUS_CLASS = {
  active: 'badge--success',
  low_stock: 'badge--warning',
  inactive: 'badge--danger',
};

function emptyForm() {
  return {
    partCode: '',
    partName: '',
    category: '',
    unitId: '',
    unitPrice: '',
    minStock: 5,
    supplierId: '',
    location: '',
    status: 'active',
    note: '',
  };
}

export default function PartListPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;
  const {
    parts, loading, error,
    params, setParams,
    create, update, remove,
  } = useParts({ branchId });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [units, setUnits] = useState([]);

  useEffect(() => {
    listUnitsApi().then(setUnits).catch(() => setUnits([]));
  }, []);

  function setSearch(v) { setParams((p) => ({ ...p, search: v })); }
  function setStatus(v) { setParams((p) => ({ ...p, status: v })); }
  function setCategory(v) { setParams((p) => ({ ...p, category: v })); }
  function setLowStockOnly(v) { setParams((p) => ({ ...p, lowStockOnly: v })); }
  function applyFilters() {}

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setShowModal(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      partCode: p.productCode ?? p.partCode ?? '',
      partName: p.productName ?? p.partName ?? '',
      category: p.category || '',
      unitId: p.unitId ?? '',
      unitPrice: p.unitPrice ?? '',
      minStock: p.minStock ?? 5,
      supplierId: p.supplierId ?? '',
      location: p.location || '',
      status: p.status || 'active',
      note: p.note || '',
    });
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
      const payload = {
        productCode: form.partCode,
        productName: form.partName,
        category: form.category,
        unitId: form.unitId === '' ? null : Number(form.unitId),
        unitPrice: form.unitPrice === '' ? null : Number(form.unitPrice),
        minStock: Number(form.minStock),
        supplierId: form.supplierId === '' ? null : Number(form.supplierId),
        location: form.location,
        status: form.status,
        note: form.note,
      };
      // Luu y: KHONG gui stockQuantity len BE - stock chi duoc thay doi qua phieu nhap/xuat.
      if (editing) {
        await update(editing.id, payload);
      } else {
        await create(payload);
      }
      closeModal();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Xac nhan xoa phu tung nay?')) return;
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

  if (!branchId) {
    return (
      <div className="part-list__error">
        Tai khoan chua duoc gan chi nhanh - lien quan admin de duoc cap nhat.
      </div>
    );
  }

  return (
    <div className="part-list">
      <div className="part-list__header">
        <div>
          <h1 className="part-list__title">Danh sach phu tung</h1>
          <p className="part-list__subtitle">Quan ly thong tin phu tung (so luong ton duoc cap nhat qua phieu nhap/xuat)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Them phu tung
        </button>
      </div>

      {/* Filters */}
      <div className="part-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tim theo ma, ten phu tung..."
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
          <option value="low_stock">Sap het</option>
          <option value="inactive">Tam ngung</option>
        </select>
        <select
          className="input input--select"
          value={params.category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Tat ca loai</option>
          <option value="Phu tung dong co">Phu tung dong co</option>
          <option value="Phu tung gam">Phu tung gam</option>
          <option value="Phu tung dien">Phu tung dien</option>
          <option value="Dau nhot & hoa chat">Dau nhot & hoa chat</option>
          <option value="Phu kien">Phu kien</option>
        </select>
        <label className="filter-low-stock">
          <input
            type="checkbox"
            checked={params.lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Sap het
        </label>
        <button className="btn btn--secondary" onClick={applyFilters}>Loc</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="part-list__loading">Dang tai...</div>
      ) : error ? (
        <div className="part-list__error">Loi: {error}</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Ma PT</th>
                <th>Ten phu tung</th>
                <th>Loai</th>
                <th>Don vi</th>
                <th>Don gia</th>
                <th>SL ton</th>
                <th>Min</th>
                <th>Trang thai</th>
                <th style={{ width: 160 }}>Hanh dong</th>
              </tr>
            </thead>
            <tbody>
              {parts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table__empty">
                    Khong co phu tung nao
                  </td>
                </tr>
              ) : (
                parts.map((p) => {
                  const stock = Number(p.stockQuantity ?? 0);
                  const min = Number(p.minStock ?? 0);
                  const isLow = stock <= min;
                  return (
                    <tr key={p.id} className={isLow ? 'row--low-stock' : ''}>
                      <td><span className="font-mono">{p.productCode ?? p.partCode}</span></td>
                      <td>{p.productName ?? p.partName}</td>
                      <td>{p.category || '—'}</td>
                      <td>{p.unitName || '—'}</td>
                      <td className="text-right">
                        {p.unitPrice != null ? Number(p.unitPrice).toLocaleString('vi-VN') + ' đ' : '—'}
                      </td>
                      <td className={`text-right ${isLow ? 'text-danger' : 'text-success'}`}>
                        {stock}
                      </td>
                      <td className="text-right">{min}</td>
                      <td>
                        <span className={`badge ${STATUS_CLASS[p.status] || ''}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                      </td>
                      <td className="table__actions">
                        <Link
                          to={`/inventory/parts/${p.id}`}
                          className="btn btn--ghost btn--sm"
                        >
                          Chi tiet
                        </Link>
                        <button className="btn btn--ghost btn--sm" onClick={() => openEdit(p)}>
                          Sua
                        </button>
                        <button
                          className="btn btn--ghost btn--sm btn--danger"
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                        >
                          Xoa
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Create / Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">{editing ? 'Sua phu tung' : 'Them phu tung'}</h2>
              <button className="modal__close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal__body">
              {formError && <div className="form-error">{formError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ma phu tung <span className="required">*</span></label>
                  <input className="input" value={form.partCode}
                    onChange={(e) => setForm({ ...form, partCode: e.target.value })} required
                    placeholder="VD: SP-0006" disabled={!!editing} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ten phu tung <span className="required">*</span></label>
                  <input className="input" value={form.partName}
                    onChange={(e) => setForm({ ...form, partName: e.target.value })} required
                    placeholder="VD: Loc gio Toyota Vios" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loai phu tung</label>
                  <select className="input input--select" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Chon loai</option>
                    <option value="Phu tung dong co">Phu tung dong co</option>
                    <option value="Phu tung gam">Phu tung gam</option>
                    <option value="Phu tung dien">Phu tung dien</option>
                    <option value="Dau nhot & hoa chat">Dau nhot & hoa chat</option>
                    <option value="Phu kien">Phu kien</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Don vi <span className="required">*</span></label>
                  <select className="input input--select" value={form.unitId} required
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
                    <option value="">Chon don vi</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Don gia (VND)</label>
                  <input className="input" type="number" min="0" value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ton toi thieu</label>
                  <input className="input" type="number" min="0" value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nha cung cap</label>
                  <input className="input" type="number" min="0" value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    placeholder="ID nha cung cap (so)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Vi tri (Kho)</label>
                  <input className="input" value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="VD: K1-A1" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trang thai</label>
                  <select className="input input--select" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Hoat dong</option>
                    <option value="low_stock">Sap het</option>
                    <option value="inactive">Tam ngung</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chu</label>
                  <input className="input" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ghi chu them..." />
                </div>
              </div>

              <div className="modal__footer">
                <button type="button" className="btn btn--secondary" onClick={closeModal}>Huy</button>
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