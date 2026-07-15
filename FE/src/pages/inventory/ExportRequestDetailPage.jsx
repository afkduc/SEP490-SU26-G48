import { Link, useParams } from 'react-router-dom';
import { useExportRequestDetail } from '../../hooks/inventory/useExportRequestDetail';
import './ExportRequestDetailPage.css';

const STATUS_META = {
  completed: { label: 'Da xuat', className: 'badge--success' },
  cancelled: { label: 'Huy', className: 'badge--danger' },
};

function formatDate(d) {
  if (!d) return '—';
  return String(d).slice(0, 10);
}

function formatDateTime(d) {
  if (!d) return '—';
  const s = String(d);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <dt className="info-row__label">{label}</dt>
      <dd className="info-row__value">{value || '—'}</dd>
    </div>
  );
}

export default function ExportRequestDetailPage() {
  const { id } = useParams();
  const { data, loading, error } = useExportRequestDetail(id);

  if (loading) return <div className="er-detail__loading">Dang tai...</div>;
  if (error) return <div className="er-detail__error">Loi: {error}</div>;
  if (!data) return null;

  const meta = STATUS_META[data.status] || { label: data.status, className: '' };
  const items = data.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  return (
    <div className="er-detail">
      <div className="er-detail__header">
        <div>
          <Link to="/inventory/export-requests" className="back-link">
            ← Danh sach phieu xuat
          </Link>
          <div className="er-detail__title-row">
            <h1 className="er-detail__title">
              Phieu xuat: <span className="font-mono">{data.requestCode}</span>
            </h1>
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        </div>
      </div>

      <div className="er-detail__body">
        <div className="er-detail__section">
          <h2 className="er-detail__section-title">Thong tin chung</h2>
          <dl className="info-list">
            <InfoRow label="Ma phieu xuat" value={data.requestCode} />
            <InfoRow label="Phieu sua chua" value={data.serviceOrderCode} />
            <InfoRow label="Khach hang" value={data.customerName} />
            <InfoRow label="Xe" value={data.vehiclePlate} />
            <InfoRow label="Ngay xuat" value={formatDate(data.exportDate)} />
            <InfoRow label="Ngay tao" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Nguoi xuat" value={data.performedByName} />
            <InfoRow label="Ghi chu" value={data.notes} />
          </dl>
        </div>

        <div className="er-detail__section">
          <h2 className="er-detail__section-title">
            Danh sach phu tung ({items.length} dong, tong SL: {totalQty})
          </h2>
          {items.length === 0 ? (
            <p className="er-detail__empty">Phieu khong co dong phu tung nao.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Ma phu tung</th>
                    <th>Ten phu tung</th>
                    <th>Don vi</th>
                    <th className="text-right" style={{ width: 120 }}>So luong</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id ?? idx}>
                      <td>{idx + 1}</td>
                      <td><span className="font-mono">{it.productCode}</span></td>
                      <td>{it.productName}</td>
                      <td>{it.unit || '—'}</td>
                      <td className="text-right">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-right"><strong>Tong cong</strong></td>
                    <td className="text-right"><strong>{totalQty}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {data.status === 'completed' && (
          <div className="er-detail__notice er-detail__notice--success">
            Phieu da duoc xuat kho. Ton kho da bi tru va he thong da ghi log vao{' '}
            <code>inventory_transactions</code> (transaction_type='export').
          </div>
        )}
        {data.status === 'cancelled' && (
          <div className="er-detail__notice er-detail__notice--danger">
            Phieu da bi huy.
          </div>
        )}
      </div>
    </div>
  );
}