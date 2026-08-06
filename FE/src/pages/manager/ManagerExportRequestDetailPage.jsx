import { Link, useParams } from 'react-router-dom';
import { useManagerExportRequest } from '../../hooks/manager/useManagerExportRequest';
import './ManagerExportRequestDetailPage.css';

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

export default function ManagerExportRequestDetailPage() {
  const { id } = useParams();
  const { data, loading, error } = useManagerExportRequest(id);

  if (loading) return <div className="mer-detail__loading">Đang tải...</div>;
  if (error) return <div className="mer-detail__error">Lỗi: {error}</div>;
  if (!data) return null;

  const items = data.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  return (
    <div className="mer-detail">
      <div className="mer-detail__header">
        <div>
          <Link to="/manager/export-requests" className="back-link">
            ← Danh sách phiếu xuất
          </Link>
          <div className="mer-detail__title-row">
            <h1 className="mer-detail__title">
              Phiếu xuất: <span className="font-mono">{data.requestCode}</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="mer-detail__body">
        <div className="mer-detail__section">
          <h2 className="mer-detail__section-title">Thông tin chung</h2>
          <dl className="info-list">
            <InfoRow label="Mã phiếu xuất" value={data.requestCode} />
            <InfoRow label="Phiếu sửa chữa" value={data.serviceOrderCode} />
            <InfoRow label="Khách hàng" value={data.customerName} />
            <InfoRow label="Xe" value={data.vehiclePlate} />
            <InfoRow label="Ngày tạo" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Người xuất" value={data.performedByName} />
            <InfoRow label="Ghi chú" value={data.notes} />
          </dl>
        </div>

        <div className="mer-detail__section">
          <h2 className="mer-detail__section-title">
            Danh sách phụ tùng ({items.length} dòng, tổng SL: {totalQty})
          </h2>
          {items.length === 0 ? (
            <p className="mer-detail__empty">Phiếu không có dòng phụ tùng nào.</p>
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

      </div>
    </div>
  );
}
