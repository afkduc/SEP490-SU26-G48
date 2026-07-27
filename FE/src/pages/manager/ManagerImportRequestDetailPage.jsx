import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useManagerImportRequest } from '../../hooks/manager/useManagerImportRequest';
import './ManagerImportRequestDetailPage.css';

const STATUS_META = {
  pending: { label: 'Chờ duyệt', className: 'badge--warning' },
  approved: { label: 'Đã duyệt', className: 'badge--success' },
  rejected: { label: 'Từ chối', className: 'badge--danger' },
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

export default function ManagerImportRequestDetailPage() {
  const { id } = useParams();
  const { data, loading, error, acting, actionError, approve, reject } = useManagerImportRequest(id);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [approveError, setApproveError] = useState('');

  async function handleApprove() {
    setApproveError('');
    try {
      await approve();
    } catch (err) {
      setApproveError(err.message || 'Duyệt thất bại');
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    setRejectError('');
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối');
      return;
    }
    try {
      await reject(rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      setRejectError(err.message || 'Từ chối thất bại');
    }
  }

  if (loading) return <div className="mir-detail__loading">Đang tải...</div>;
  if (error) return <div className="mir-detail__error">Lỗi: {error}</div>;
  if (!data) return null;

  const meta = STATUS_META[data.status] || { label: data.status, className: '' };
  const items = data.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const isPending = data.status === 'pending';

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
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        </div>

        {isPending && (
          <div className="mir-detail__actions">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setShowRejectModal(true)}
              disabled={acting}
            >
              Từ chối
            </button>
            <button
              type="button"
              className="btn btn--success"
              onClick={handleApprove}
              disabled={acting}
            >
              {acting ? 'Đang xử lý...' : 'Duyệt phiếu'}
            </button>
          </div>
        )}
      </div>

      {approveError && <div className="mir-detail__alert">{approveError}</div>}
      {actionError && <div className="mir-detail__alert">{actionError}</div>}

      <div className="mir-detail__body">
        <div className="mir-detail__section">
          <h2 className="mir-detail__section-title">Thông tin chung</h2>
          <dl className="info-list">
            <InfoRow label="Mã phiếu" value={data.requestCode} />
            <InfoRow label="Nhà cung cấp" value={data.supplierName} />
            <InfoRow label="Số hóa đơn NCC" value={data.supplierInvoiceNo} />
            <InfoRow label="Ngày nhập" value={formatDate(data.importDate)} />
            <InfoRow label="Ngày tạo" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Người tạo" value={data.requestedByName} />
            <InfoRow label="Người duyệt" value={data.approvedByName} />
            <InfoRow label="Lý do từ chối" value={data.rejectReason} />
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

        {data.status === 'approved' && (
          <div className="mir-detail__notice mir-detail__notice--success">
            Phiếu đã được duyệt. Tồn kho đã được cộng và hệ thống đã ghi log
            vào <code>inventory_transactions</code>.
          </div>
        )}
        {data.status === 'rejected' && (
          <div className="mir-detail__notice mir-detail__notice--danger">
            Phiếu đã bị từ chối và không cộng tồn kho.
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="mir-detail__modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="mir-detail__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mir-detail__modal-title">Từ chối phiếu nhập</h3>
            <p className="mir-detail__modal-desc">
              Vui lòng nhập lý do từ chối. Phiếu sẽ chuyển sang trạng thái
              &quot;Từ chối&quot; và không cộng tồn kho.
            </p>
            <form onSubmit={handleRejectSubmit}>
              <textarea
                className="input"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: Số lượng không khớp với hóa đơn..."
                maxLength={500}
                required
              />
              {rejectError && <div className="mir-detail__alert">{rejectError}</div>}
              <div className="mir-detail__modal-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowRejectModal(false)}
                  disabled={acting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn--danger"
                  disabled={acting}
                >
                  {acting ? 'Đang gửi...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}