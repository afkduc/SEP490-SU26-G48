import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { ROLES } from '../../constants/roles';
import { useImportRequestDetail } from '../../hooks/inventory/useImportRequestDetail';
import { useImportRequestApproval } from '../../hooks/inventory/useImportRequestApproval';
import './ImportRequestDetailPage.css';

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

export default function ImportRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, refetch, setData } = useImportRequestDetail(id);

  const canApprove = user?.roles?.includes(ROLES.MANAGER) || user?.roles?.includes(ROLES.ADMIN);

  const { approve, reject, approving, rejecting, error: actionError } = useImportRequestApproval(
    (updated) => setData(updated),
  );

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitError, setRejectSubmitError] = useState('');
  const [approveError, setApproveError] = useState('');

  async function handleApprove() {
    setApproveError('');
    try {
      await approve(id);
    } catch (err) {
      setApproveError(err.message || 'Duyet that bai');
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    setRejectSubmitError('');
    if (!rejectReason.trim()) {
      setRejectSubmitError('Vui long nhap ly do tu choi');
      return;
    }
    try {
      await reject(id, rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      setRejectSubmitError(err.message || 'Tu choi that bai');
    }
  }

  if (loading) return <div className="ir-detail__loading">Dang tai...</div>;
  if (error) return <div className="ir-detail__error">Loi: {error}</div>;
  if (!data) return null;

  const meta = STATUS_META[data.status] || { label: data.status, className: '' };
  const items = data.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const isPending = data.status === 'pending';

  return (
    <div className="ir-detail">
      <div className="ir-detail__header">
        <div>
          <Link to="/inventory/import-requests" className="back-link">
            ← Danh sach phieu nhap
          </Link>
          <div className="ir-detail__title-row">
            <h1 className="ir-detail__title">
              Phieu nhap: <span className="font-mono">{data.requestCode}</span>
            </h1>
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        </div>

        {canApprove && isPending && (
          <div className="ir-detail__actions">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setShowRejectModal(true)}
              disabled={approving || rejecting}
            >
              Tu choi
            </button>
            <button
              type="button"
              className="btn btn--success"
              onClick={handleApprove}
              disabled={approving || rejecting}
            >
              {approving ? 'Dang duyet...' : 'Duyet phieu'}
            </button>
          </div>
        )}
      </div>

      {approveError && <div className="ir-detail__alert">{approveError}</div>}
      {actionError && <div className="ir-detail__alert">{actionError}</div>}

      <div className="ir-detail__body">
        <div className="ir-detail__section">
          <h2 className="ir-detail__section-title">Thong tin chung</h2>
          <dl className="info-list">
            <InfoRow label="Ma phieu" value={data.requestCode} />
            <InfoRow label="Nha cung cap" value={data.supplierName} />
            <InfoRow label="So hoa don NCC" value={data.supplierInvoiceNo} />
            <InfoRow label="Ngay nhap" value={formatDate(data.importDate)} />
            <InfoRow label="Ngay tao" value={formatDateTime(data.createdAt)} />
            <InfoRow label="Nguoi tao" value={data.requestedByName} />
            <InfoRow label="Nguoi duyet" value={data.approvedByName} />
            <InfoRow label="Ngay duyet" value={formatDateTime(data.approvedBy ? data.importDate : null)} />
            <InfoRow label="Ly do tu choi" value={data.rejectReason} />
            <InfoRow label="Ghi chu" value={data.notes} />
          </dl>
        </div>

        <div className="ir-detail__section">
          <h2 className="ir-detail__section-title">
            Danh sach phu tung ({items.length} dong, tong SL: {totalQty})
          </h2>
          {items.length === 0 ? (
            <p className="ir-detail__empty">Phieu khong co dong phu tung nao.</p>
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
          <div className="ir-detail__notice ir-detail__notice--success">
            Phieu da duoc duyet. Ton kho cho cac phu tung tren da duoc cong va he thong
            da ghi log vao <code>inventory_transactions</code>.
          </div>
        )}
        {data.status === 'rejected' && (
          <div className="ir-detail__notice ir-detail__notice--danger">
            Phieu da bi tu choi va khong cong ton kho.
          </div>
        )}
      </div>

      {/* Modal tu choi */}
      {showRejectModal && (
        <div className="ir-detail__modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="ir-detail__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ir-detail__modal-title">Tu choi phieu nhap</h3>
            <p className="ir-detail__modal-desc">
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
              {rejectSubmitError && (
                <div className="ir-detail__alert">{rejectSubmitError}</div>
              )}
              <div className="ir-detail__modal-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejecting}
                >
                  Huy
                </button>
                <button
                  type="submit"
                  className="btn btn--danger"
                  disabled={rejecting}
                >
                  {rejecting ? 'Dang gui...' : 'Xac nhan tu choi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}