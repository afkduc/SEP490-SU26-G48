import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useManagerImportRequest } from '../../hooks/manager/useManagerImportRequest';
import './ManagerImportRequestDetailPage.css';

const STATUS_META = {
  pending: { label: 'Cho duyet', className: 'badge--warning' },
  approved: { label: 'Da duyet', className: 'badge--success' },
  rejected: { label: 'Tu choi', className: 'badge--danger' },
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
      setApproveError(err.message || 'Duyet that bai');
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    setRejectError('');
    if (!rejectReason.trim()) {
      setRejectError('Vui long nhap ly do tu choi');
      return;
    }
    try {
      await reject(rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      setRejectError(err.message || 'Tu choi that bai');
    }
  }

  if (loading) return <div className="mir-detail__loading">Dang tai...</div>;
  if (error) return <div className="mir-detail__error">Loi: {error}</div>;
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
            ← Danh sach phieu nhap
          </Link>
          <div className="mir-detail__title-row">
            <h1 className="mir-detail__title">
              Phieu nhap: <span className="font-mono">{data.requestCode}</span>
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
              Tu choi
            </button>
            <button
              type="button"
              className="btn btn--success"
              onClick={handleApprove}
              disabled={acting}
            >
              {acting ? 'Dang xu ly...' : 'Duyet phieu'}
            </button>
          </div>
        )}
      </div>

      {approveError && <div className="mir-detail__alert">{approveError}</div>}
      {actionError && <div className="mir-detail__alert">{actionError}</div>}

      <div className="mir-detail__body">
        <div className="mir-detail__section">
          <h2 className="mir-detail__section-title">Thong tin chung</h2>
          <dl className="info-list">
            <InfoRow label="Ma phieu" value={data.requestCode} />
            <InfoRow label="Nha cung cap" value={data.supplierName} />
            <InfoRow label="So hoa don NCC" value={data.supplierInvoiceNo} />
            <InfoRow label="Ngay nhap" value={formatDate(data.importDate)} />
            <InfoRow label="Ngay tao" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Nguoi tao" value={data.requestedByName} />
            <InfoRow label="Nguoi duyet" value={data.approvedByName} />
            <InfoRow label="Ly do tu choi" value={data.rejectReason} />
            <InfoRow label="Ghi chu" value={data.notes} />
          </dl>
        </div>

        <div className="mir-detail__section">
          <h2 className="mir-detail__section-title">
            Danh sach phu tung ({items.length} dong, tong SL: {totalQty})
          </h2>
          {items.length === 0 ? (
            <p className="mir-detail__empty">Phieu khong co dong phu tung nao.</p>
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

        {data.status === 'approved' && (
          <div className="mir-detail__notice mir-detail__notice--success">
            Phieu da duoc duyet. Ton kho da duoc cong va he thong da ghi log
            vao <code>inventory_transactions</code>.
          </div>
        )}
        {data.status === 'rejected' && (
          <div className="mir-detail__notice mir-detail__notice--danger">
            Phieu da bi tu choi va khong cong ton kho.
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="mir-detail__modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="mir-detail__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mir-detail__modal-title">Tu choi phieu nhap</h3>
            <p className="mir-detail__modal-desc">
              Vui long nhap ly do tu choi. Phieu se chuyen sang trang thai
              &quot;Tu choi&quot; va khong cong ton kho.
            </p>
            <form onSubmit={handleRejectSubmit}>
              <textarea
                className="input"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: So luong khong khop voi hoa don..."
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
                  Huy
                </button>
                <button
                  type="submit"
                  className="btn btn--danger"
                  disabled={acting}
                >
                  {acting ? 'Dang gui...' : 'Xac nhan tu choi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}