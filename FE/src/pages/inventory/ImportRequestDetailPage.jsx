import { useParams, Link } from 'react-router-dom';
import { useImportRequestDetail } from '../../hooks/inventory/useImportRequestDetail';
import './ImportRequestDetailPage.css';

const STATUS_META = {
  approved: { label: 'Đã nhập kho', className: 'badge--success' },
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

export default function ImportRequestDetailPage() {
  const { id } = useParams();
  const { data, loading, error } = useImportRequestDetail(id);

  if (loading) return <div className="ir-detail__loading">Đang tải...</div>;
  if (error) return <div className="ir-detail__error">Lỗi: {error}</div>;
  if (!data) return null;

  const meta = STATUS_META[data.status] || { label: data.status, className: '' };
  const items = data.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  return (
    <div className="ir-detail">
      <div className="ir-detail__header">
        <div>
          <Link to="/inventory/import-requests" className="back-link">
            ← Danh sách phiếu nhập
          </Link>
          <div className="ir-detail__title-row">
            <h1 className="ir-detail__title">
              Phiếu nhập: <span className="font-mono">{data.requestCode}</span>
            </h1>
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        </div>

      </div>

      <div className="ir-detail__body">
        <div className="ir-detail__section">
          <h2 className="ir-detail__section-title">Thông tin chung</h2>
          <dl className="info-list">
            <InfoRow label="Mã phiếu" value={data.requestCode} />
            <InfoRow label="Nhà cung cấp" value={data.supplierName} />
            <InfoRow label="Số hóa đơn NCC" value={data.supplierInvoiceNo} />
            <InfoRow label="Ngày nhập" value={formatDate(data.importDate)} />
            <InfoRow label="Ngày tạo" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Người tạo" value={data.requestedByName} />
            <InfoRow label="Ghi chú" value={data.notes} />
          </dl>
        </div>

        <div className="ir-detail__section">
          <h2 className="ir-detail__section-title">
            Danh sách phụ tùng ({items.length} dòng, tổng SL: {totalQty})
          </h2>
          {items.length === 0 ? (
            <p className="ir-detail__empty">Phiếu không có dòng phụ tùng nào.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Mã phụ tùng</th>
                    <th>Tên phụ tùng</th>
                    <th>Đơn vị</th>
                    <th className="text-right" style={{ width: 120 }}>Số lượng</th>
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
                    <td colSpan={4} className="text-right"><strong>Tổng cộng</strong></td>
                    <td className="text-right"><strong>{totalQty}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {data.status === 'approved' && (
          <div className="ir-detail__notice ir-detail__notice--success">
            Phiếu đã được nhập kho.
            </div>
        )}
      </div>
    </div>
  );
}
