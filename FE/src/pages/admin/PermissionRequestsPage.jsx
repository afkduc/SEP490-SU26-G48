import { useEffect, useState, useCallback } from 'react';
import permissionRequestApi from '../../services/permissionRequestApi';
import { useToast } from '../../components/common/ToastContext';
import { getPermissionScreenLabel } from '../../utils/screenLabels';
import './PermissionRequestsPage.css';

function formatDateTime(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function countPending(items) {
  return items.filter((r) => !r.status || r.status === 'pending').length;
}

/**
 * Panel duyệt yêu cầu cấp quyền.
 * @param {{ onCountChange?: (n: number) => void }} props
 */
export function PermissionRequestsPanel({ onCountChange }) {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permissionRequestApi.listPending();
      const items = Array.isArray(data?.items) ? data.items : [];
      // Giữ lại các dòng vừa duyệt/từ chối trong session để hiển thị trạng thái nút
      setRequests((prev) => {
        const pendingIds = new Set(items.map((i) => i.requestId));
        const processed = prev.filter(
          (r) => (r.status === 'approved' || r.status === 'rejected') && !pendingIds.has(r.requestId),
        );
        return [
          ...items.map((i) => ({ ...i, status: 'pending' })),
          ...processed,
        ];
      });
    } catch (e) {
      toast.error('Lỗi tải danh sách yêu cầu: ' + (e?.message || 'unknown'));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Đồng bộ badge count sau khi requests đổi — không gọi setState parent trong updater
  useEffect(() => {
    onCountChange?.(countPending(requests));
  }, [requests, onCountChange]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleApprove = async (req) => {
    const screenName = getPermissionScreenLabel(req.permissionKey);
    if (!window.confirm(
      `Duyệt cấp màn "${screenName}" cho ${req.userName || req.userEmail}?\n\n`
      + 'Hệ thống sẽ cấp ngay quyền View/Create/Edit/Disable/Export cho đúng user này '
      + '(không cần mở ma trận). User sẽ bị đăng xuất để áp dụng ngay.',
    )) {
      return;
    }
    setActionLoadingId(req.requestId);
    try {
      const result = await permissionRequestApi.approve(req.requestId);
      toast.success(
        `Đã duyệt "${getPermissionScreenLabel(result.permissionKey || req.permissionKey)}" cho ${req.userName || req.userEmail}.`,
        4000,
      );
      setRequests((prev) =>
        prev.map((r) =>
          r.requestId === req.requestId ? { ...r, status: 'approved' } : r,
        ),
      );
    } catch (e) {
      toast.error('Lỗi duyệt: ' + (e?.message || 'unknown'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (req) => {
    setRejectModalId(req.requestId);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectModalId) return;
    setActionLoadingId(rejectModalId);
    try {
      await permissionRequestApi.reject(rejectModalId, rejectReason || null);
      toast.warning('Đã từ chối yêu cầu');
      setRejectModalId(null);
      setRejectReason('');
      setRequests((prev) =>
        prev.map((r) =>
          r.requestId === rejectModalId ? { ...r, status: 'rejected' } : r,
        ),
      );
    } catch (e) {
      toast.error('Lỗi từ chối: ' + (e?.message || 'unknown'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = countPending(requests);

  return (
    <div className="perm-req-panel">
      <div className="perm-req-panel__toolbar">
        <div>
          <h2 className="perm-req-panel__title">Yêu cầu đang chờ duyệt</h2>
          <p className="perm-req-panel__subtitle">
            <strong>Duyệt</strong> = cấp ngay toàn quyền màn đó cho đúng user (không cần vào ma trận),
            rồi đăng xuất user để áp dụng. <strong>Mở ma trận</strong> chỉ dùng khi muốn cấp theo
            vai trò (áp dụng mọi user cùng role) thay vì cấp riêng từng người.
          </p>
        </div>
        <div className="perm-req-panel__actions-bar">
          <span className="perm-req-panel__count">
            {loading ? 'Đang tải...' : `${pendingCount} yêu cầu`}
          </span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={fetchRequests}
            disabled={loading}
          >
            Làm mới
          </button>
        </div>
      </div>

      <div className="perm-req-panel__card">
        <table className="perm-req-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Permission Key</th>
              <th>Lý do</th>
              <th>Trang yêu cầu</th>
              <th>Thời điểm</th>
              <th className="perm-req-table__th-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="perm-req-table__empty">Đang tải...</td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="perm-req-table__empty">
                  <div className="perm-req-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p>Không có yêu cầu cấp quyền nào đang chờ.</p>
                  </div>
                </td>
              </tr>
            ) : (
              requests.map((req) => {
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';
                const isBusy = actionLoadingId === req.requestId;
                return (
                  <tr
                    key={req.requestId}
                    className={`perm-req-row${isApproved ? ' perm-req-row--approved' : ''}${isRejected ? ' perm-req-row--rejected' : ''}`}
                  >
                    <td>
                      <div className="perm-req-user">
                        <div className="perm-req-avatar">{getInitials(req.userName)}</div>
                        <div className="perm-req-user-info">
                          <div className="perm-req-user-name">{req.userName || req.userEmail}</div>
                          <div className="perm-req-user-email">{req.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="perm-req-key-wrap">
                        <span className="perm-req-key-label">
                          {getPermissionScreenLabel(req.permissionKey)}
                        </span>
                        <code className="perm-req-key">{req.permissionKey}</code>
                      </div>
                    </td>
                    <td className="perm-req-reason">
                      {req.reason || <span className="perm-req-muted">—</span>}
                    </td>
                    <td className="perm-req-page-cell">
                      {req.page || <span className="perm-req-muted">—</span>}
                    </td>
                    <td className="perm-req-time">{formatDateTime(req.createdAt)}</td>
                    <td>
                      <div className="perm-req-actions">
                        {isApproved ? (
                          <button
                            type="button"
                            className="btn btn--success btn--sm btn--approved"
                            disabled
                          >
                            Đã duyệt
                          </button>
                        ) : isRejected ? (
                          <button
                            type="button"
                            className="btn btn--danger btn--sm btn--rejected"
                            disabled
                          >
                            Đã từ chối
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn--success btn--sm"
                              onClick={() => handleApprove(req)}
                              disabled={isBusy}
                            >
                              {isBusy ? '...' : 'Duyệt'}
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              onClick={() => openRejectModal(req)}
                              disabled={isBusy}
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {rejectModalId !== null && (
        <div className="perm-req-modal-overlay" onClick={() => setRejectModalId(null)}>
          <div className="perm-req-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Từ chối yêu cầu cấp quyền</h3>
            <p className="perm-req-modal-desc">
              User sẽ nhận được thông báo từ chối. Lý do (tùy chọn):
            </p>
            <textarea
              className="input"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="VD: Quyền này chỉ dành cho vai trò khác..."
            />
            <div className="perm-req-modal-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setRejectModalId(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={submitReject}
                disabled={actionLoadingId === rejectModalId}
              >
                {actionLoadingId === rejectModalId ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Trang admin duyệt yêu cầu cấp quyền (độc lập, không còn ma trận). */
export default function PermissionRequestsPage() {
  return (
    <div className="permission-requests-page">
      <div className="permission-requests-page__header" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Yêu cầu cấp quyền</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
          Duyệt hoặc từ chối các yêu cầu truy cập màn hình từ người dùng.
        </p>
      </div>
      <PermissionRequestsPanel />
    </div>
  );
}
