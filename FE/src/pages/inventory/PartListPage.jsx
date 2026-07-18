import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useParts } from '../../hooks/inventory/useParts';
import './PartListPage.css';

const STATUS_LABELS = {
  active: 'Hoat dong',
  inactive: 'Tam ngung',
};

const STATUS_CLASS = {
  active: 'badge--success',
  inactive: 'badge--danger',
};

function emptyForm() {
  return {
    partCode: '',
    partName: '',
    category: '',
    unit: '',
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
    parts, total, loading, error, categories,
    params,
    setSearch, setStatus, setCategory, setLowStockOnly, setPage,
    create, update, remove,
  } = useParts({ branchId });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setShowModal(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      partCode: p.productCode ?? '',
      partName: p.productName ?? '',
      category: p.category || '',
      unit: p.unit || '',
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
        category: form.category || null,
        unitId: form.unitId ? Number(form.unitId) : 1,
        unitPrice: form.unitPrice === '' ? null : Number(form.unitPrice),
        minStock: Number(form.minStock),
        supplierId: form.supplierId === '' ? null : Number(form.supplierId),
        location: form.location,
        status: form.status,
        note: form.note,
      };
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

  const totalPages = Math.max(1, Math.ceil(total / (params.limit || 20)));

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
        <select
          className="input input--select"
          value={params.category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Tat ca loai</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label className="filter-low-stock">
          <input
            type="checkbox"
            checked={params.lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Sap het
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="part-list__loading">Dang tai...</div>
      ) : error ? (
        <div className="part-list__error">Loi: {error}</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Ma PT</th>
                  <th>Ten phu tung</th>
                  <th>Loai</th>
                  <th>Don vi</th>
                  <th className="text-right">Don gia</th>
                  <th className="text-right">SL ton</th>
                  <th className="text-right">Min</th>
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
                    const isLow = stock <= min && min > 0;
                    return (
                      <tr key={p.id} className={isLow ? 'row--low-stock' : ''}>
                        <td><span className="font-mono">{p.productCode ?? '—'}</span></td>
                        <td>
                          <Link to={`/inventory/parts/${p.id}`}>{p.productName ?? '—'}</Link>
                        </td>
                        <td>{p.category || '—'}</td>
                        <td>{p.unit || '—'}</td>
                        <td className="text-right">
                          {p.unitPrice != null ? `${Number(p.unitPrice).toLocaleString('vi-VN')} đ` : '—'}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="part-list__pagination">
              <button
                className="btn btn--ghost btn--sm"
                disabled={params.page <= 1}
                onClick={() => setPage(params.page - 1)}
              >
                ← Truoc
              </button>
              <span className="part-list__page-info">
                Trang {params.page} / {totalPages} (tong {total})
              </span>
              <button
                className="btn btn--ghost btn--sm"
                disabled={params.page >= totalPages}
                onClick={() => setPage(params.page + 1)}
              >
                Sau →
              </button>
            </div>
          )}
        </>
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
                    <option value="Dau nhot &amp; hoa chat">Dau nhot &amp; hoa chat</option>
                    <option value="Phu kien">Phu kien</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Don vi</label>
                  <input className="input" value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="VD: Cai, Bo, Chai" />
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
