import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useManagerExportRequest } from '../../hooks/manager/useManagerExportRequest';
import { useManagerInventoryNotify } from '../../contexts/ManagerInventoryNotifyContext';
import { markExportRequestSeenApi } from '../../services/managerExportRequestApi';
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
  const { decrementNewExportRequestCount } = useManagerInventoryNotify();

  // Chi khi Manager mo trang chi tiet thi cham do moi mat (khac voi Kho phu
  // tung dung hover) - goi mark-seen 1 lan duy nhat khi phieu con la "moi".
  const seenRef = useRef(false);
  useEffect(() => {
    if (!data || !data.isNewForManager || seenRef.current) return;
    seenRef.current = true;
    decrementNewExportRequestCount();
    markExportRequestSeenApi(data.id).catch(() => {});
  }, [data, decrementNewExportRequestCount]);

  if (loading) return <div className="mer-detail__loading">Đang tải...</div>;
  if (error) return <div className="mer-detail__error">Lỗi: {error}</div>;
  if (!data) return null;

  const items = data.items || [];

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
            {/* Ma phieu xuat gio la ma RIENG (ERB-...), khac ma Lenh sua chua. */}
            <InfoRow label="Lệnh sửa chữa" value={data.repairOrderCode} />
            <InfoRow label="Khách hàng" value={data.customerName} />
            <InfoRow label="Xe" value={data.vehiclePlate} />
            <InfoRow label="Cố vấn dịch vụ" value={data.advisorName} />
            <InfoRow label="Ngày tạo" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Người xuất" value={data.performedByName} />
            <InfoRow label="Người lấy/trả" value={data.receivedByName} />
          </dl>
        </div>

        <div className="mer-detail__section">
          <h2 className="mer-detail__section-title">
            Danh sách phụ tùng ({items.length} dòng)
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
              </table>
            </div>
          )}
        </div>

        {(data.receivedSignatureData || data.issuerSignatureData) && (
          <div className="mer-detail__section">
            <h2 className="mer-detail__section-title">Chữ ký xác nhận</h2>
            <div className="mer-detail__signatures">
              {/* NV kho ky lai MOI lan xuat/tra - day la chu ky cua LAN GAN
                  NHAT, xem het lich su tung lan o "Lich su luu phieu". */}
              {data.issuerSignatureData && (
                <div className="mer-detail__signature-box">
                  <div className="mer-detail__signature-role">Nhân viên kho (lần gần nhất)</div>
                  <img src={data.issuerSignatureData} alt="Chữ ký nhân viên kho" className="mer-detail__signature-img" />
                  {data.issuerName && <div className="mer-detail__signature-name">{data.issuerName}</div>}
                  {data.issuerSignedAt && <div className="mer-detail__signature-date">Ký lúc: {data.issuerSignedAt}</div>}
                </div>
              )}
              {data.receivedSignatureData && (
                <div className="mer-detail__signature-box">
                  <div className="mer-detail__signature-role">Người lấy/trả (lần gần nhất)</div>
                  <img src={data.receivedSignatureData} alt="Chữ ký người lấy" className="mer-detail__signature-img" />
                  {data.receivedByName && <div className="mer-detail__signature-name">{data.receivedByName}</div>}
                  {data.receivedSignedAt && <div className="mer-detail__signature-date">Ký lúc: {data.receivedSignedAt}</div>}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
