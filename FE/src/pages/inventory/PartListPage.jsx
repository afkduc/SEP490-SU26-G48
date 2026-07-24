import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useParts } from '../../hooks/inventory/useParts';
import { listUnitsApi } from '../../services/productApi';
import { getSuppliersApi } from '../../services/supplierApi';
import './PartListPage.css';

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Tạm ngừng',
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
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    listUnitsApi().then(setUnits).catch(() => setUnits([]));
    getSuppliersApi({ status: 'active' })
      .then((res) => setSuppliers(res.items || []))
      .catch(() => setSuppliers([]));
  }, []);

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
        unitId: form.unitId === '' ? null : Number(form.unitId),
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
    if (!window.confirm('Xác nhận xóa phụ tùng này?')) return;
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
        Tài khoản chưa được gán chi nhánh - liên hệ admin để được cập nhật.
      </div>
    );
  }

  return (
    <div className="part-list">
      <div className="part-list__header">
        <div>
          <h1 className="part-list__title">Danh sách phụ tùng</h1>
          <p className="part-list__subtitle">Quản lý thông tin phụ tùng (số lượng tồn được cập nhật qua phiếu nhập/xuất)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Thêm phụ tùng
        </button>
      </div>

      {/* Filters */}
      <div className="part-list__filters">
        <input
          className="input input--search"
          type="text"
          placeholder="Tìm theo mã, tên phụ tùng..."
          value={params.search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input input--select"
          value={params.status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Tạm ngừng</option>
        </select>
        <select
          className="input input--select"
          value={params.category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Tất cả loại</option>
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
          Sắp hết
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="part-list__loading">Đang tải...</div>
      ) : error ? (
        <div className="part-list__error">Lỗi: {error}</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã PT</th>
                  <th>Tên phụ tùng</th>
                  <th>Loại</th>
                  <th>Đơn vị</th>
                  <th className="text-right">Đơn giá</th>
                  <th className="text-right">SL tồn</th>
                  <th className="text-right">Tối thiểu</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 160 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {parts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="table__empty">
                      Không có phụ tùng nào
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
                        <td>{p.unitName || p.unit || '—'}</td>
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
                            Chi tiết
                          </Link>
                          <button className="btn btn--ghost btn--sm" onClick={() => openEdit(p)}>
                            Sửa
                          </button>
                          <button
                            className="btn btn--ghost btn--sm btn--danger"
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                          >
                            Xóa
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
                ← Trước
              </button>
              <span className="part-list__page-info">
                Trang {params.page} / {totalPages} (tổng {total})
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
              <h2 className="modal__title">{editing ? 'Sửa phụ tùng' : 'Thêm phụ tùng'}</h2>
              <button className="modal__close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal__body">
              {formError && <div className="form-error">{formError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mã phụ tùng <span className="required">*</span></label>
                  <input className="input" value={form.partCode}
                    onChange={(e) => setForm({ ...form, partCode: e.target.value })} required
                    placeholder="VD: SP-0006" disabled={!!editing} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên phụ tùng <span className="required">*</span></label>
                  <input className="input" value={form.partName}
                    onChange={(e) => setForm({ ...form, partName: e.target.value })} required
                    placeholder="VD: Lọc gió Toyota Vios" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loại phụ tùng</label>
                  <select className="input input--select" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Chọn loại</option>
                    <option value="Phụ tùng động cơ">Phụ tùng động cơ</option>
                    <option value="Phụ tùng gầm">Phụ tùng gầm</option>
                    <option value="Phụ tùng điện">Phụ tùng điện</option>
                    <option value="Dầu nhớt &amp; hóa chất">Dầu nhớt &amp; hóa chất</option>
                    <option value="Phụ kiện">Phụ kiện</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Đơn vị <span className="required">*</span></label>
                  <select className="input input--select" value={form.unitId} required
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
                    <option value="">Chọn đơn vị</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Đơn giá (VND)</label>
                  <input className="input" type="number" min="0" value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tồn tối thiểu</label>
                  <input className="input" type="number" min="0" value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nhà cung cấp</label>
                  <select className="input input--select" value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                    <option value="">-- Chọn nhà cung cấp --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.supplierName} ({s.supplierCode})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vị trí (Kho)</label>
                  <input className="input" value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="VD: K1-A1" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trạng thái</label>
                  <select className="input input--select" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Hoạt động</option>
                    <option value="low_stock">Sắp hết</option>
                    <option value="inactive">Tạm ngừng</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <input className="input" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ghi chú thêm..." />
                </div>
              </div>

              <div className="modal__footer">
                <button type="button" className="btn btn--secondary" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn btn--primary">
                  {editing ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
