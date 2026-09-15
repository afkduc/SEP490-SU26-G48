import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useExportRequestDetail } from '../../hooks/inventory/useExportRequestDetail';
import ExportPickupHistoryModal from './ExportPickupHistoryModal';
import './ExportRequestDetailPage.css';

const STATUS_META = {
  completed: { label: 'Đã xuất', className: 'badge--success' },
};

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
  const [showHistory, setShowHistory] = useState(false);

  if (loading) return <div className="er-detail__loading">Đang tải...</div>;
  if (error) return <div className="er-detail__error">Lỗi: {error}</div>;
  if (!data) return null;

  const meta = STATUS_META[data.status] || { label: data.status, className: '' };
  const items = data.items || [];

  return (
    <div className="er-detail">
      <div className="er-detail__header">
        <div>
          <Link to="/inventory/export-requests" className="back-link">
            ← Danh sách phiếu xuất
          </Link>
          <div className="er-detail__title-row">
            <h1 className="er-detail__title">
              Phiếu xuất: <span className="font-mono">{data.requestCode}</span>
            </h1>
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        </div>
      </div>

      <div className="er-detail__body">
        <div className="er-detail__section">
          <h2 className="er-detail__section-title">Thông tin chung</h2>
          <dl className="info-list">
            {/* Ma phieu xuat = ma lenh sua chua (1 ma di cung phieu tu dau den
                cuoi), da hien o tieu de - chi giu 1 dong tham chieu o day. */}
            <InfoRow label="Lệnh sửa chữa" value={data.repairOrderCode} />
            <InfoRow label="Khách hàng" value={data.customerName} />
            <InfoRow label="Xe" value={data.vehiclePlate} />
            <InfoRow label="Ngày tạo" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Người xuất" value={data.performedByName} />
            <InfoRow label="Người lấy" value={data.receivedByName} />
          </dl>
        </div>

        <div className="er-detail__section">
          <div className="er-detail__section-head">
            <h2 className="er-detail__section-title">
              Danh sách phụ tùng ({items.length} dòng)
            </h2>
            {/* Bang duoi la so cong don MOI NHAT; lich su xem tung lan da luu. */}
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setShowHistory(true)}>
              Lịch sử lưu phiếu
            </button>
          </div>
          {items.length === 0 ? (
            <p className="er-detail__empty">Phiếu không có dòng phụ tùng nào.</p>
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
              </table>
            </div>
          )}
        </div>

        {data.receivedSignatureData && (
          <div className="er-detail__section">
            <h2 className="er-detail__section-title">Chữ ký người lấy</h2>
            <div className="er-detail__signature-box">
              <img
                src={data.receivedSignatureData}
                alt="Chữ ký người lấy"
                className="er-detail__signature-img"
              />
              {data.receivedByName && (
                <div className="er-detail__signature-name">{data.receivedByName}</div>
              )}
              {data.receivedSignedAt && (
                <div className="er-detail__signature-date">Ký lúc: {data.receivedSignedAt}</div>
              )}
            </div>
          </div>
        )}

        {data.status === 'completed' && (
          <div className="er-detail__notice er-detail__notice--success">
            Phiếu đã được xuất kho.
           </div>
        )}
      </div>

      {showHistory && (
        <ExportPickupHistoryModal
          exportRequestId={data.id}
          repairOrderCode={data.requestCode}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
