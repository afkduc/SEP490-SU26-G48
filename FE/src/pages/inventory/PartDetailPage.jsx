import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePartDetail } from '../../hooks/inventory/usePartDetail';
import { useParts } from '../../hooks/inventory/useParts';
import { useInventoryBranch } from './InventoryLayout';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { listUnitsApi } from '../../services/productApi';
import { PermissionGate } from '../../components/PermissionGate';
import './PartDetailPage.css';

const STATUS_LABELS = {
  active: 'Hoạt động',
  low_stock: 'Sắp hết',
  inactive: 'Tạm ngừng',
};

export default function PartDetailPage() {
  const { id } = useParams();
  const confirm = useConfirm();
  const { branchId, loadingBranches, branchError } = useInventoryBranch();
  const { part, history, loading, error, refetch } = usePartDetail(id);
  const { update, deactivate, reactivate } = useParts({ branchId });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [units, setUnits] = useState([]);

  useEffect(() => {
    listUnitsApi().then(setUnits).catch(() => setUnits([]));
  }, []);

  function startEdit() {
    setForm({
      productName: part.productName,
      category: part.category || '',
      unitId: part.unitId ?? '',
      unitPrice: part.unitPrice ?? '',
      minStock: part.minStock ?? 5,
      supplierId: part.supplierId ?? '',
      location: part.location || '',
      status: part.status || 'active',
      note: part.note || '',
    });
    setFormError('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm(null);
    setFormError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        unitId: form.unitId === '' ? null : Number(form.unitId),
        unitPrice: form.unitPrice === '' ? null : Number(form.unitPrice),
        minStock: Number(form.minStock),
        supplierId: form.supplierId === '' || form.supplierId == null ? null : Number(form.supplierId),
      };
      await update(id, payload);
      setEditing(false);
      setForm(null);
      await refetch();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    const isActive = part.status === 'active';
    const ok = await confirm({
      title: isActive ? 'Tạm ngừng phụ tùng' : 'Kích hoạt phụ tùng',
      message: isActive
        ? 'Tạm ngừng phụ tùng này? Phụ tùng sẽ không còn được chọn khi lập phiếu.'
        : 'Kích hoạt lại phụ tùng này?',
      confirmText: isActive ? 'Tạm ngừng' : 'Kích hoạt',
      tone: isActive ? 'warning' : 'primary',
    });
    if (!ok) return;
    setToggling(true);
    setFormError('');
    try {
      if (isActive) await deactivate(id);
      else await reactivate(id);
      await refetch();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setToggling(false);
    }
  }

  if (!branchId) {
    return (
      <div className="detail-error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để xem chi tiết phụ tùng.')}
      </div>
    );
  }
  if (loading) return <div className="detail-loading">Đang tải...</div>;
  if (error) return <div className="detail-error">Lỗi: {error}</div>;
  if (!part) return <div className="detail-error">Không tìm thấy phụ tùng</div>;

  const stock = Number(part.stockQuantity ?? 0);
  const min = Number(part.minStock ?? 0);
  const isLow = stock <= min;

  return (
    <div className="part-detail">
      <div className="part-detail__header">
        <div className="part-detail__title-row">
          <div>
            <h1 className="part-detail__title">{part.productName}</h1>
            <p className="part-detail__code font-mono">{part.productCode}</p>
          </div>
          <div className="part-detail__actions">
            {!editing && (
              <>
                <PermissionGate permission="screen:inventory:products:update">
                  <button className="btn btn--secondary" onClick={startEdit}>Sửa</button>
                </PermissionGate>
                <PermissionGate permission="screen:inventory:products:delete">
                  <button
                    className="btn btn--ghost btn--danger"
                    onClick={handleToggleStatus}
                    disabled={toggling}
                  >
                    {toggling
                      ? 'Đang xử lý...'
                      : part.status === 'active'
                        ? 'Ngừng'
                        : 'Kích hoạt'}
                  </button>
                </PermissionGate>
              </>
            )}
            <Link to="/inventory/parts" className="btn btn--ghost">Quay lại</Link>
          </div>
        </div>
        <span className={`badge ${isLow ? 'badge--warning' : 'badge--success'}`}>
          {isLow ? 'Cảnh báo sắp hết hàng' : 'Còn hàng'}
        </span>
        <span className={`badge ${part.status === 'inactive' ? 'badge--danger' : 'badge--success'}`} style={{ marginLeft: 8 }}>
          {STATUS_LABELS[part.status] || part.status}
        </span>
      </div>

      {/* Info grid */}
      <div className="detail-grid">
        <div className="detail-card">
          <h3 className="detail-card__title">Thông tin cơ bản</h3>

          {editing ? (
            <form onSubmit={handleSave} className="detail-form">
              {formError && <div className="form-error">{formError}</div>}

              <div className="form-group">
                <label className="form-label">Tên phụ tùng <span className="required">*</span></label>
                <input className="input" value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loại</label>
                  <select className="input input--select" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Chọn loại</option>
                    <option value="Phụ tùng động cơ">Phụ tùng động cơ</option>
                    <option value="Phụ tùng gầm">Phụ tùng gầm</option>
                    <option value="Phụ tùng điện">Phụ tùng điện</option>
                    <option value="Dầu nhớt & hóa chất">Dầu nhớt & hóa chất</option>
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
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tồn tối thiểu</label>
                  <input className="input" type="number" min="0" value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nhà cung cấp (ID)</label>
                  <input className="input" type="number" min="0" value={form.supplierId ?? ''}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    placeholder="ID nhà cung cấp" />
                </div>
                <div className="form-group">
                  <label className="form-label">Vị trí kho</label>
                  <input className="input" value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="VD: K1-A1" />
                </div>
              </div>

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
                <textarea className="input" rows={2} value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>

              <div className="detail-form__footer">
                <button type="button" className="btn btn--secondary" onClick={cancelEdit}>Hủy</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          ) : (
            <div className="detail-info-list">
              <DetailRow label="Mã phụ tùng" value={<span className="font-mono">{part.productCode}</span>} />
              <DetailRow label="Tên phụ tùng" value={part.productName} />
              <DetailRow label="Loại" value={part.category || '—'} />
              <DetailRow label="Thương hiệu" value={part.brandName || '—'} />
              <DetailRow label="Đơn vị" value={part.unitName || '—'} />
              <DetailRow label="Nhà cung cấp" value={part.supplierName || part.supplierId || '—'} />
            </div>
          )}
        </div>

        <div className="detail-card">
          <h3 className="detail-card__title">Tồn kho (chỉ đọc)</h3>
          <div className={`stock-highlight ${isLow ? 'stock-highlight--warn' : 'stock-highlight--ok'}`}>
            <span className="stock-highlight__number">{stock}</span>
            <span className="stock-highlight__unit">{part.unitName || ''}</span>
          </div>
          <div className="detail-info-list">
            <DetailRow label="Tồn tối thiểu" value={min} />
            <DetailRow
              label="Giá trị tồn kho"
              value={
                part.unitPrice != null
                  ? (stock * Number(part.unitPrice)).toLocaleString('vi-VN') + ' đ'
                  : '—'
              }
            />
            <DetailRow
              label="Đơn giá"
              value={part.unitPrice != null ? Number(part.unitPrice).toLocaleString('vi-VN') + ' đ' : '—'}
            />
            <DetailRow label="Vị trí" value={part.location || '—'} />
            <DetailRow
              label="Trạng thái"
              value={<span className={`badge ${isLow ? 'badge--warning' : 'badge--success'}`}>
                {isLow ? 'Sắp hết' : 'Còn hàng'}
              </span>}
            />
          </div>
          <p className="detail-hint">
            Số lượng tồn chỉ được thay đổi qua phiếu nhập/xuất kho (sẽ thêm ở phase sau).
          </p>
        </div>
      </div>

      {/* Lịch sử tồn kho */}
      <div className="detail-card detail-card--full">
        <h3 className="detail-card__title">Lịch sử tồn kho</h3>
        {history.length === 0 ? (
          <p className="detail-empty">
            Chưa có giao dịch nào (lịch sử sẽ hiển thị khi có phiếu nhập/xuất).
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Loại</th>
                  <th>Số lượng</th>
                  <th>Ngày</th>
                  <th>Người thực hiện</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.id}>
                    <td><span className="font-mono">{tx.transactionCode}</span></td>
                    <td>{tx.transactionType}</td>
                    <td className="text-right">
                      {tx.transactionType === 'import' ? '+' : '-'}{tx.quantity}
                    </td>
                    <td>{tx.transactionDate}</td>
                    <td>{tx.performedBy}</td>
                    <td>{tx.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-row__label">{label}</span>
      <span className="detail-row__value">{value}</span>
    </div>
  );
}