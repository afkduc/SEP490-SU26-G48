import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupplierDetail } from '../../hooks/inventory/useSupplierDetail';
import './SupplierDetailPage.css';

const STATUS_LABELS = { active: 'Hoat dong', inactive: 'Tam ngung' };
const STATUS_CLASS = { active: 'badge--success', inactive: 'badge--danger' };

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="info-row">
      <dt className="info-row__label">{label}</dt>
      <dd className="info-row__value">{value}</dd>
    </div>
  );
}

export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supplier, loading, error, saving, save } = useSupplierDetail(id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');

  function startEdit() {
    setForm({ ...supplier });
    setEditing(true);
    setFormError('');
  }

  function cancelEdit() {
    setEditing(false);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      await save(form);
      setEditing(false);
    } catch (err) {
      setFormError(err.message);
    }
  }

  if (loading) return <div className="sup-detail__loading">Dang tai...</div>;
  if (error) return <div className="sup-detail__error">Loi: {error}</div>;
  if (!supplier) return null;

  return (
    <div className="sup-detail">
      <div className="sup-detail__header">
        <div className="sup-detail__header-left">
          <Link to="/inventory/suppliers" className="back-link">← Danh sach NCC</Link>
          <h1 className="sup-detail__title">{supplier.supplierName}</h1>
          <span className={`badge ${STATUS_CLASS[supplier.status] || ''}`}>
            {STATUS_LABELS[supplier.status] || supplier.status}
          </span>
        </div>
        <div className="sup-detail__header-right">
          {!editing ? (
            <button className="btn btn--secondary" onClick={startEdit}>
              Chinh sua
            </button>
          ) : (
            <>
              <button className="btn btn--secondary" onClick={cancelEdit}>Huy</button>
              <button className="btn btn--primary" form="detail-form" type="submit" disabled={saving}>
                {saving ? 'Dang luu...' : 'Luu'}
              </button>
            </>
          )}
        </div>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <div className="sup-detail__body">
        {/* Thong tin co ban */}
        <div className="sup-detail__section">
          <h2 className="sup-detail__section-title">Thong tin co ban</h2>
          {editing ? (
            <form id="detail-form" onSubmit={handleSubmit} className="detail-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ma NCC</label>
                  <input className="input" value={form.supplierCode || ''}
                    onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Ten NCC</label>
                  <input className="input" value={form.supplierName || ''}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nguoi lien he</label>
                  <input className="input" value={form.contactName || ''}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">So dien thoai</label>
                  <input className="input" type="tel" value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" type="email" value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ma so thue</label>
                  <input className="input" value={form.taxCode || ''}
                    onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Dia chi</label>
                <input className="input" value={form.address || ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trang thai</label>
                  <select className="input input--select" value={form.status || 'active'}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Hoat dong</option>
                    <option value="inactive">Tam ngung</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Ghi chu</label>
                <textarea className="input" rows={3} value={form.note || ''}
                  onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </form>
          ) : (
            <dl className="info-list">
              <InfoRow label="Ma NCC" value={supplier.supplierCode} />
              <InfoRow label="Nguoi lien he" value={supplier.contactName} />
              <InfoRow label="So dien thoai" value={supplier.phone} />
              <InfoRow label="Email" value={supplier.email} />
              <InfoRow label="Dia chi" value={supplier.address} />
              <InfoRow label="Ma so thue" value={supplier.taxCode} />
              <InfoRow label="Ghi chu" value={supplier.note} />
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
