import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { usePartDetail } from '../../hooks/inventory/usePartDetail';
import { useParts } from '../../hooks/inventory/useParts';
import './PartDetailPage.css';

const STATUS_LABELS = {
  active: 'Hoat dong',
  low_stock: 'Sap het',
  inactive: 'Tam ngung',
};

const TX_TYPE_LABELS = {
  import: 'Nhap kho',
  export: 'Xuat kho',
};

export default function PartDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { part, history, loading, error, refetch } = usePartDetail(id);
  const { update, remove } = useParts();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function startEdit() {
    setForm({
      partName: part.partName,
      category: part.category || '',
      unit: part.unit || 'Cai',
      unitPrice: part.unitPrice ?? '',
      minStock: part.minStock ?? 5,
      location: part.location || '',
      status: part.status,
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
        unitPrice: form.unitPrice === '' ? null : Number(form.unitPrice),
        minStock: Number(form.minStock),
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

  async function handleDelete() {
    if (!window.confirm('Xac nhan xoa phu tung nay?')) return;
    setDeleting(true);
    setFormError('');
    try {
      await remove(id);
      navigate('/inventory/parts', { replace: true });
    } catch (err) {
      setFormError(err.message);
      setDeleting(false);
    }
  }

  if (loading) return <div className="detail-loading">Dang tai...</div>;
  if (error) return <div className="detail-error">Loi: {error}</div>;
  if (!part) return <div className="detail-error">Khong tim thay phu tung</div>;

  const isLow = part.stockQuantity < part.minStock;

  return (
    <div className="part-detail">
      <div className="part-detail__header">
        <div className="part-detail__title-row">
          <div>
            <h1 className="part-detail__title">{part.partName}</h1>
            <p className="part-detail__code font-mono">{part.partCode}</p>
          </div>
          <div className="part-detail__actions">
            {!editing && (
              <>
                <button className="btn btn--secondary" onClick={startEdit}>Sua</button>
                <button
                  className="btn btn--ghost btn--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Dang xoa...' : 'Xoa'}
                </button>
              </>
            )}
            <Link to="/inventory/parts" className="btn btn--ghost">Quay lai</Link>
          </div>
        </div>
        <span className={`badge ${isLow ? 'badge--warning' : 'badge--success'}`}>
          {isLow ? 'Canh bao sap het hang' : 'Con hang'}
        </span>
      </div>

      {/* Info grid */}
      <div className="detail-grid">
        <div className="detail-card">
          <h3 className="detail-card__title">Thong tin co ban</h3>

          {editing ? (
            <form onSubmit={handleSave} className="detail-form">
              {formError && <div className="form-error">{formError}</div>}

              <div className="form-group">
                <label className="form-label">Ten phu tung <span className="required">*</span></label>
                <input className="input" value={form.partName}
                  onChange={(e) => setForm({ ...form, partName: e.target.value })} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loai</label>
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
                  <label className="form-label">Don vi</label>
                  <input className="input" value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Don gia (VND)</label>
                  <input className="input" type="number" min="0" value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ton toi thieu</label>
                  <input className="input" type="number" min="0" value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Vi tri kho</label>
                <input className="input" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="VD: K1-A1" />
              </div>

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
                <textarea className="input" rows={2} value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>

              <div className="detail-form__footer">
                <button type="button" className="btn btn--secondary" onClick={cancelEdit}>Huy</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Dang luu...' : 'Luu thay doi'}
                </button>
              </div>
            </form>
          ) : (
            <div className="detail-info-list">
              <DetailRow label="Ma phu tung" value={<span className="font-mono">{part.partCode}</span>} />
              <DetailRow label="Ten phu tung" value={part.partName} />
              <DetailRow label="Loai" value={part.category || '—'} />
              <DetailRow label="Thuong hieu" value={part.brandName || '—'} />
              <DetailRow label="Don vi" value={part.unit || '—'} />
              <DetailRow label="Nha cung cap" value={part.supplierName || '—'} />
            </div>
          )}
        </div>

        <div className="detail-card">
          <h3 className="detail-card__title">Ton kho</h3>
          <div className={`stock-highlight ${isLow ? 'stock-highlight--warn' : 'stock-highlight--ok'}`}>
            <span className="stock-highlight__number">{part.stockQuantity}</span>
            <span className="stock-highlight__unit">{part.unit || 'Cai'}</span>
          </div>
          {!editing && (
            <div className="detail-info-list">
              <DetailRow label="Ton toi thieu" value={part.minStock} />
              <DetailRow
                label="Gia tri ton kho"
                value={
                  part.unitPrice != null
                    ? (part.stockQuantity * part.unitPrice).toLocaleString('vi-VN') + ' đ'
                    : '—'
                }
              />
              <DetailRow label="Don gia" value={part.unitPrice != null ? part.unitPrice.toLocaleString('vi-VN') + ' đ' : '—'} />
              <DetailRow label="Vi tri" value={part.location || '—'} />
              <DetailRow
                label="Trang thai"
                value={<span className={`badge ${isLow ? 'badge--warning' : 'badge--success'}`}>
                  {isLow ? 'Sap het' : 'Con hang'}
                </span>}
              />
            </div>
          )}
        </div>
      </div>

      {/* Lich su ton kho */}
      <div className="detail-card detail-card--full">
        <h3 className="detail-card__title">Lich su ton kho</h3>
        {history.length === 0 ? (
          <p className="detail-empty">Chua co giao dich nao</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Ma phieu</th>
                  <th>Loai</th>
                  <th>So luong</th>
                  <th>Ngay</th>
                  <th>Nguoi thuc hien</th>
                  <th>Ghi chu</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.id}>
                    <td><span className="font-mono">{tx.transactionCode}</span></td>
                    <td>
                      <span className={`badge ${tx.transactionType === 'import' ? 'badge--success' : 'badge--warning'}`}>
                        {TX_TYPE_LABELS[tx.transactionType] || tx.transactionType}
                      </span>
                    </td>
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
