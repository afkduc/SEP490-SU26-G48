import { useParams, Link } from 'react-router-dom';
import { useSupplierDetail } from '../../hooks/inventory/useSupplierDetail';
import './SupplierDetailPage.css';

const STATUS_LABELS = { active: 'Hoat dong', inactive: 'Tam ngung' };
const STATUS_CLASS = { active: 'badge--success', inactive: 'badge--danger' };

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="info-row">
      <dt className="info-row__label">{label}</dt>
      <dd className="info-row__value">{value}</dd>
    </div>
  );
}

export default function SupplierDetailPage() {
  const { id } = useParams();
  const { supplier, partsFromSupplier, loading, error } = useSupplierDetail(id);

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
      </div>

      <div className="sup-detail__body">
        {/* Thong tin co ban */}
        <div className="sup-detail__section">
          <h2 className="sup-detail__section-title">Thong tin lien he</h2>
          <dl className="info-list">
            <InfoRow label="Ma NCC" value={supplier.supplierCode} />
            <InfoRow label="Nguoi lien he" value={supplier.contactName} />
            <InfoRow label="So dien thoai" value={supplier.phone} />
            <InfoRow label="Email" value={supplier.email} />
            <InfoRow label="Dia chi" value={supplier.address} />
            <InfoRow label="Ma so thue" value={supplier.taxCode} />
          </dl>
        </div>

        {/* Phu tung dang cung cap */}
        <div className="sup-detail__section">
          <h2 className="sup-detail__section-title">
            Phu tung dang cung cap ({partsFromSupplier.length})
          </h2>
          {partsFromSupplier.length === 0 ? (
            <p className="sup-detail__empty">NCC chua cung cap phu tung nao trong he thong.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ma PT</th>
                    <th>Ten phu tung</th>
                    <th>Loai</th>
                    <th>Don vi</th>
                    <th>SL ton</th>
                  </tr>
                </thead>
                <tbody>
                  {partsFromSupplier.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/inventory/parts/${p.id}`} className="font-mono">
                          {p.productCode}
                        </Link>
                      </td>
                      <td>{p.productName}</td>
                      <td>{p.category || '—'}</td>
                      <td>{p.unit || '—'}</td>
                      <td className="text-right">{p.stockQuantity ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}