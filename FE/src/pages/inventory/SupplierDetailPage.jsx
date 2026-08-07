import { useParams, Link } from 'react-router-dom';
import { useSupplierDetail } from '../../hooks/inventory/useSupplierDetail';
import './SupplierDetailPage.css';

const STATUS_LABELS = { active: 'Hoạt động', inactive: 'Tạm ngừng' };
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

  if (loading) return <div className="sup-detail__loading">Đang tải...</div>;
  if (error) return <div className="sup-detail__error">Lỗi: {error}</div>;
  if (!supplier) return null;

  return (
    <div className="sup-detail">
      <div className="sup-detail__header">
        <div className="sup-detail__header-left">
          <Link to="/inventory/suppliers" className="back-link">← Danh sách NCC</Link>
          <h1 className="sup-detail__title">{supplier.supplierName}</h1>
          <span className={`badge ${STATUS_CLASS[supplier.status] || ''}`}>
            {STATUS_LABELS[supplier.status] || supplier.status}
          </span>
        </div>
      </div>

      <div className="sup-detail__body">
        {/* Thông tin cơ bản */}
        <div className="sup-detail__section">
          <h2 className="sup-detail__section-title">Thông tin liên hệ</h2>
          <dl className="info-list">
            <InfoRow label="Mã NCC" value={supplier.supplierCode} />
            <InfoRow label="Người liên hệ" value={supplier.contactName} />
            <InfoRow label="Số điện thoại" value={supplier.phone} />
            <InfoRow label="Email" value={supplier.email} />
            <InfoRow label="Địa chỉ" value={supplier.address} />
            <InfoRow label="Mã số thuế" value={supplier.taxCode} />
          </dl>
        </div>

        {/* Phụ tùng đang cung cấp */}
        <div className="sup-detail__section">
          <h2 className="sup-detail__section-title">
            Phụ tùng đang cung cấp ({partsFromSupplier.length})
          </h2>
          {partsFromSupplier.length === 0 ? (
            <p className="sup-detail__empty">NCC chưa cung cấp phụ tùng nào trong hệ thống.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã PT</th>
                    <th>Tên phụ tùng</th>
                    <th>Loại</th>
                    <th>Đơn vị</th>
                    <th>SL tồn</th>
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
                      <td>{p.unitName || '—'}</td>
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
