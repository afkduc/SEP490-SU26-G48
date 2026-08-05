import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminBranchesApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import { useApiError } from '../../hooks/useApiError';
import { formatPhoneDisplay } from '../../utils/validation';
import PermissionGate from '../../components/PermissionGate';
import './AdminBranchesPage.css';

const IconBranch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconPhone = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const IconMail = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
);

const IconAlert = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

function getInitials(firstName, lastName, userName) {
  const f = firstName || '';
  const l = lastName || '';
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  if (userName) return userName.slice(0, 2).toUpperCase();
  return '?';
}

function ConfirmDeactivateModal({ branch, onClose, onConfirm, loading }) {
  return (
    <div className="confirm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="confirm-modal">
        <div className="confirm-modal__icon">
          <IconAlert />
        </div>
        <h3 className="confirm-modal__title">Ngưng hoạt động chi nhánh?</h3>
        <p className="confirm-modal__body">
          Chi nhánh <strong>{branch?.branchName}</strong> sẽ bị ngưng hoạt động.
          Nhân viên tại chi nhánh này sẽ không thể đăng nhập vào hệ thống.
          Không xóa cứng — bạn có thể kích hoạt lại sau.
        </p>
        <div className="confirm-modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button className="btn btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Ngưng'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BranchCard({ branch, onOpen, onEdit, onDeactivate, onReactivate }) {
  const initials = getInitials(null, null, branch.managerName);

  return (
    <div className={`branch-card ${branch.isActive ? 'branch-card--active' : 'branch-card--inactive'}`}>
      <div className="branch-card__accent-bar" />

      <div className="branch-card__header">
        <div className="branch-card__title-block">
          <span className="branch-card__code">{branch.branchCode}</span>
          <span className="branch-card__name">{branch.branchName}</span>
        </div>
        <span className={`branch-card__status-badge branch-card__status-badge--${branch.isActive ? 'active' : 'inactive'}`}>
          <span className="branch-card__status-dot" aria-hidden="true" />
          {branch.isActive ? 'Hoạt động' : 'Dừng hoạt động'}
        </span>
      </div>

      <div className="branch-card__body">
        {branch.address && (
          <div className="branch-card__info-row">
            <IconMapPin />
            <span>{branch.address}</span>
          </div>
        )}
        {branch.phone && (
          <div className="branch-card__info-row">
            <IconPhone />
            <span>{formatPhoneDisplay(branch.phone)}</span>
          </div>
        )}
        {branch.email && (
          <div className="branch-card__info-row">
            <IconMail />
            <span>{branch.email}</span>
          </div>
        )}

        <div className="branch-card__manager">
          <div className="branch-card__manager-avatar">{initials}</div>
          <div className="branch-card__manager-info">
            {branch.managerName ? (
              <>
                <span className="branch-card__manager-name">{branch.managerName}</span>
                <span className="branch-card__manager-role">Quản lý chi nhánh</span>
              </>
            ) : (
              <span className="branch-card__manager-none">Chưa có quản lý</span>
            )}
          </div>
        </div>
      </div>

      <div className="branch-card__actions">
        <button type="button" className="branch-card__btn branch-card__btn--stats" onClick={() => onOpen(branch)} title="Xem chi tiết">
          <IconRefresh />
          Chi tiết
        </button>
        <PermissionGate permission="admin:branches:update">
          <button type="button" className="branch-card__btn branch-card__btn--edit" onClick={() => onEdit(branch)} title="Chỉnh sửa">
            <IconEdit />
            Sửa
          </button>
        </PermissionGate>
        {branch.isActive ? (
          <PermissionGate permission="admin:branches:deactivate">
            <button type="button" className="branch-card__btn branch-card__btn--danger" onClick={() => onDeactivate(branch)} title="Ngưng hoạt động">
              <IconTrash />
              Ngưng
            </button>
          </PermissionGate>
        ) : (
          <PermissionGate permission="admin:branches:update">
            <button type="button" className="branch-card__btn branch-card__btn--edit" onClick={() => onReactivate?.(branch)} title="Kích hoạt lại">
              <IconRefresh />
              Kích hoạt
            </button>
          </PermissionGate>
        )}
      </div>
    </div>
  );
}

export default function AdminBranchesPage({ embedded = false } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { handleApiError } = useApiError();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [reactivateLoadingId, setReactivateLoadingId] = useState(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const branchesRes = await adminBranchesApi.listFull();
      setBranches(branchesRes?.items || []);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách chi nhánh');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await adminBranchesApi.deactivate(deactivateTarget.id);
      toast.success(`Chi nhánh "${deactivateTarget.branchName}" đã được ngưng hoạt động`);
      setDeactivateTarget(null);
      loadData();
    } catch (err) {
      if (!handleApiError(err, 'admin:branches:deactivate')) {
        toast.error(err.message || 'Lỗi khi ngưng hoạt động chi nhánh');
      }
    } finally {
      setDeactivateLoading(false);
    }
  }

  async function handleReactivate(branch) {
    if (!branch?.id || reactivateLoadingId) return;
    setReactivateLoadingId(branch.id);
    try {
      await adminBranchesApi.reactivate(branch.id);
      toast.success(`Chi nhánh "${branch.branchName}" đã được kích hoạt lại`);
      loadData();
    } catch (err) {
      if (!handleApiError(err, 'admin:branches:update')) {
        toast.error(err.message || 'Lỗi khi kích hoạt chi nhánh');
      }
    } finally {
      setReactivateLoadingId(null);
    }
  }

  const activeCount = branches.filter((b) => b.isActive).length;
  const inactiveCount = branches.filter((b) => !b.isActive).length;

  const headerActions = (
    <div className="admin-branches__actions">
      {branches.length > 0 && (
        <span className="admin-branches__total-badge">
          {activeCount} hoạt động{activeCount !== inactiveCount && inactiveCount > 0 ? ` · ${inactiveCount} ngừng` : ''}
        </span>
      )}
      <button className="btn btn--primary" onClick={() => navigate('/admin/catalog/branches/new')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Thêm chi nhánh
      </button>
    </div>
  );

  return (
    <div className={`admin-branches${embedded ? ' admin-branches--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-branches__header">
          <div className="admin-branches__title-block">
            <div className="admin-branches__title-icon">
              <IconBranch />
            </div>
            <div className="admin-branches__title-group">
              <h1>Quản lý chi nhánh</h1>
              <p className="admin-branches__subtitle">Danh sách và thông tin các chi nhánh AutoGara</p>
            </div>
          </div>
          {headerActions}
        </div>
      )}

      {embedded && (
        <div className="admin-hub__toolbar">
          {headerActions}
        </div>
      )}

      {loading && (
        <div className="admin-branches__loading">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>Đang tải danh sách chi nhánh...</span>
        </div>
      )}

      {error && !loading && (
        <div className="admin-branches__error">
          <IconAlert />
          <span>{error}</span>
          <button className="btn btn--secondary btn--sm" onClick={loadData}>Thử lại</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="admin-branches__stats-row">
            <div className="branch-stat-card">
              <span className="branch-stat-card__value">{branches.length}</span>
              <span className="branch-stat-card__label">Tổng chi nhánh</span>
            </div>
            <div className="branch-stat-card branch-stat-card--active">
              <span className="branch-stat-card__value">{activeCount}</span>
              <span className="branch-stat-card__label">Đang hoạt động</span>
            </div>
            <div className="branch-stat-card branch-stat-card--inactive">
              <span className="branch-stat-card__value">{inactiveCount}</span>
              <span className="branch-stat-card__label">Dừng hoạt động</span>
            </div>
          </div>

          {branches.length === 0 ? (
            <div className="admin-branches__empty">
              <IconBranch />
              <p>Chưa có chi nhánh nào</p>
              <button className="btn btn--primary" onClick={() => navigate('/admin/catalog/branches/new')}>
                Thêm chi nhánh đầu tiên
              </button>
            </div>
          ) : (
            <div className="admin-branches__cards">
              {branches.map((branch) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  onOpen={(b) => navigate(`/admin/catalog/branches/${b.id}`, { state: { fromListSearch: window.location.search } })}
                  onEdit={(b) => navigate(`/admin/catalog/branches/${b.id}/edit`, { state: { fromListSearch: window.location.search } })}
                  onDeactivate={(b) => setDeactivateTarget(b)}
                  onReactivate={handleReactivate}
                />
              ))}
            </div>
          )}
        </>
      )}

      {deactivateTarget && (
        <ConfirmDeactivateModal
          branch={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={handleDeactivate}
          loading={deactivateLoading}
        />
      )}
    </div>
  );
}
