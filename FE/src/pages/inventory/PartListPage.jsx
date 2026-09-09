import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInventoryBranch } from './InventoryLayout';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { useParts } from '../../hooks/inventory/useParts';
import { listUnitsApi } from '../../services/productApi';
import { PermissionGate } from '../../components/PermissionGate';
import { getSuppliersApi } from '../../services/supplierApi';
import { getLowStockApi } from '../../services/inventoryApi';
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
    status: 'active',
    note: '',
  };
}

export default function PartListPage() {
  const { branchId, loadingBranches, branchError } = useInventoryBranch();
  const confirm = useConfirm();
  const {
    parts, total, loading, error, categories,
    params,
    setSearch, setStatus, setCategory, setLowStockOnly, setPage,
    create, update, deactivate, reactivate,
  } = useParts({ branchId });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    listUnitsApi().then(setUnits).catch(() => setUnits([]));
    getSuppliersApi({ status: 'active' })
      .then((res) => setSuppliers(res.items || []))
      .catch(() => setSuppliers([]));
  }, []);

  const refreshLowStock = () => {
    if (!branchId) return;
    getLowStockApi(branchId)
      .then((res) => setLowStock(res?.items || []))
      .catch(() => setLowStock([]));
  };

  useEffect(() => {
    refreshLowStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

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
        status: form.status,
        note: form.note,
      };
      if (editing) {
        await update(editing.id, payload);
      } else {
        await create(payload);
      }
      closeModal();
      refreshLowStock();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleToggleStatus(p) {
    const isActive = p.status === 'active';
    const ok = await confirm({
      title: isActive ? 'Tạm ngừng phụ tùng' : 'Kích hoạt phụ tùng',
      message: isActive
        ? 'Tạm ngừng phụ tùng này? Phụ tùng sẽ không còn được chọn khi lập phiếu.'
        : 'Kích hoạt lại phụ tùng này?',
      confirmText: isActive ? 'Tạm ngừng' : 'Kích hoạt',
      tone: isActive ? 'warning' : 'primary',
    });
    if (!ok) return;
    setTogglingId(p.id);
    try {
      if (isActive) await deactivate(p.id);
      else await reactivate(p.id);
      refreshLowStock();
    } finally {
      setTogglingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / (params.limit || 20)));

  if (!branchId) {
    return (
      <div className="part-list__error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để xem phụ tùng.')}
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
        <PermissionGate permission="screen:inventory:products:create">
          <button className="btn btn--primary" onClick={openCreate}>
            + Thêm phụ tùng
          </button>
        </PermissionGate>
      </div>

      {/* Cảnh báo tồn kho thấp */}
      {lowStock.length > 0 && (
        <div className="part-alert">
          <h2 className="part-alert__title">⚠ Cảnh báo tồn kho thấp</h2>
          <p className="part-alert__desc">
            Có {lowStock.length} phụ tùng đang ở mức sắp hết ({'<= '} tồn tối thiểu). Cần nhập thêm hàng.
          </p>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã PT</th>
                  <th>Tên phụ tùng</th>
                  <th>SL tồn</th>
                  <th>Tồn tối thiểu</th>
                  <th>Thiếu</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td><span className="font-mono">{p.productCode ?? p.partCode}</span></td>
                    <td>
                      <Link to={`/inventory/parts/${p.id}`}>{p.productName ?? p.partName}</Link>
                    </td>
                    <td className="text-right text-danger">{p.stockQuantity}</td>
                    <td className="text-right">{p.minStock}</td>
                    <td className="text-right text-danger">{p.stockQuantity - p.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                        <td className="text-left">
                          {p.unitPrice != null ? `${Number(p.unitPrice).toLocaleString('vi-VN')} đ` : '—'}
                        </td>
                        <td className={`text-left ${isLow ? 'text-danger' : 'text-success'}`}>
                          {stock}
                        </td>
                        <td className="text-left">{min}</td>
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
                          <PermissionGate permission="screen:inventory:products:update">
                            <button className="btn btn--ghost btn--sm" onClick={() => openEdit(p)}>
                              Sửa
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="screen:inventory:products:delete">
                            <button
                              className="btn btn--ghost btn--sm btn--danger"
                              onClick={() => handleToggleStatus(p)}
                              disabled={togglingId === p.id}
                            >
                              {p.status === 'active' ? 'Ngừng' : 'Kích hoạt'}
                            </button>
                          </PermissionGate>
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
