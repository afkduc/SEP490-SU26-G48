import { useParams, Link } from 'react-router-dom';
import { useManagerImportRequest } from '../../hooks/manager/useManagerImportRequest';
import './ManagerImportRequestDetailPage.css';

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

export default function ManagerImportRequestDetailPage() {
  const { id } = useParams();
  const { data, loading, error } = useManagerImportRequest(id);

  if (loading) return <div className="mir-detail__loading">Đang tải...</div>;
  if (error) return <div className="mir-detail__error">Lỗi: {error}</div>;
  if (!data) return null;

  const items = data.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  return (
    <div className="mir-detail">
      <div className="mir-detail__header">
        <div>
          <Link to="/manager/import-requests" className="back-link">
            ← Danh sách phiếu nhập
          </Link>
          <div className="mir-detail__title-row">
            <h1 className="mir-detail__title">
              Phiếu nhập: <span className="font-mono">{data.requestCode}</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="mir-detail__body">
        <div className="mir-detail__section">
          <h2 className="mir-detail__section-title">Thông tin chung</h2>
          <dl className="info-list">
            <InfoRow label="Mã phiếu" value={data.requestCode} />
            <InfoRow label="Nhà cung cấp" value={data.supplierName} />
            <InfoRow label="Số hóa đơn NCC" value={data.supplierInvoiceNo} />
            <InfoRow label="Ngày tạo" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Người nhập" value={data.requestedByName} />
            <InfoRow label="Ghi chú" value={data.notes} />
          </dl>
        </div>

        <div className="mir-detail__section">
          <h2 className="mir-detail__section-title">
            Danh sách phụ tùng ({items.length} dòng, tổng SL: {totalQty})
          </h2>
          {items.length === 0 ? (
            <p className="mir-detail__empty">Phiếu không có dòng phụ tùng nào.</p>
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

        {data.status === 'rejected' && (
          <div className="mir-detail__notice mir-detail__notice--danger">
            Phiếu đã bị từ chối và không cộng tồn kho.
          </div>
        )}
      </div>
    </div>
  );
}
