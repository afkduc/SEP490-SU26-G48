import { useEffect, useState } from 'react';
import { adminBranchesApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import { useApiError } from '../../hooks/useApiError';
import PermissionGate from '../../components/PermissionGate';
import './AdminBranchesPage.css';

// ─── Icons ────────────────────────────────────────────────────────────

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

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(value) {
  if (value == null) return '—';
  const num = Number(value);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} tỷ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} triệu`;
  return num.toLocaleString('vi-VN');
}

function getInitials(firstName, lastName, userName) {
  const f = firstName || '';
  const l = lastName || '';
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  if (userName) return userName.slice(0, 2).toUpperCase();
  return '?';
}

function formatPhone(phone) {
  if (!phone) return null;
  return phone;
}

// ─── Branch Form Modal ──────────────────────────────────────────────

function BranchFormModal({ branch, onClose, onSuccess, managerCandidates }) {
  const isEdit = Boolean(branch?.id);
  const [form, setForm] = useState({
    branchCode: branch?.branchCode || '',
    branchName: branch?.branchName || '',
    address: branch?.address || '',
    phone: branch?.phone || '',
    email: branch?.email || '',
    managerId: branch?.managerId || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.branchName.trim()) {
      setError('Tên chi nhánh là bắt buộc');
      return;
    }
    if (!isEdit && !form.branchCode.trim()) {
      setError('Mã chi nhánh là bắt buộc');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        branchName: form.branchName.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        managerId: form.managerId ? Number(form.managerId) : null,
      };
      if (!isEdit) {
        payload.branchCode = form.branchCode.trim();
      }

      if (isEdit) {
        await adminBranchesApi.update(branch.id, payload);
      } else {
        await adminBranchesApi.create(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu chi nhánh');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="branch-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="branch-modal">
        <div className="branch-modal__header">
          <h2 className="branch-modal__title">
            {isEdit ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}
          </h2>
          <button className="branch-modal__close" onClick={onClose} type="button">
            <IconX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="branch-modal__body">
            <div className="form-group">
              <label>
                Mã chi nhánh <span>*</span>
              </label>
              <input
                type="text"
                value={form.branchCode}
                onChange={(e) => set('branchCode', e.target.value)}
                placeholder="VD: HN, HCM, DNA"
                maxLength={20}
                required
                disabled={isEdit}
              />
              <p className="form-hint">Mã chi nhánh là duy nhất, không thể thay đổi sau khi tạo</p>
            </div>

            <div className="form-group">
              <label>
                Tên chi nhánh <span>*</span>
              </label>
              <input
                type="text"
                value={form.branchName}
                onChange={(e) => set('branchName', e.target.value)}
                placeholder="VD: AutoGara Hà Nội"
                required
              />
            </div>

            <div className="form-group">
              <label>Địa chỉ</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="VD: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="VD: 024-3333-1111"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="VD: hn@autogara.vn"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Quản lý chi nhánh</label>
              <select
                value={form.managerId}
                onChange={(e) => set('managerId', e.target.value)}
              >
                <option value="">— Chưa chọn —</option>
                {managerCandidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} {m.branchName ? `(Đang ở ${m.branchName})` : '(Chưa có chi nhánh)'}
                  </option>
                ))}
              </select>
              <p className="form-hint">Chỉ hiển thị user có vai trò Quản lý chi nhánh</p>
            </div>

            {error && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
                {error}
              </div>
            )}
          </div>

          <div className="branch-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo chi nhánh'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm Deactivate Modal ──────────────────────────────────────

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
          Bạn có chắc muốn tiếp tục?
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

// ─── Branch Card ────────────────────────────────────────────────────

function BranchCard({ branch, onEdit, onDeactivate, onReactivate, onStats }) {
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
            <span>{formatPhone(branch.phone)}</span>
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
        <button type="button" className="branch-card__btn branch-card__btn--stats" onClick={() => onStats(branch)} title="Xem thống kê">
          <IconRefresh />
          Thống kê
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

// ─── Stats Modal ────────────────────────────────────────────────────

function StatsModal({ branch, stats, onClose }) {
  return (
    <div className="branch-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="branch-modal">
        <div className="branch-modal__header">
          <h2 className="branch-modal__title">
            Thống kê — {branch?.branchName}
          </h2>
          <button className="branch-modal__close" onClick={onClose} type="button">
            <IconX />
          </button>
        </div>
        <div className="branch-modal__body">
          {stats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4f46e5' }}>{stats.userCount}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Nhân viên</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#059669' }}>{stats.orderCount}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Đơn hàng</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706' }}>{formatCurrency(stats.revenue30Days)}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Doanh thu 30d</div>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                * Doanh thu tính theo tổng giá trị đơn hàng đã hoàn thành trong 30 ngày gần nhất
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Đang tải...</div>
          )}
        </div>
        <div className="branch-modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminBranchesPage({ embedded = false } = {}) {
  const toast = useToast();
  const { handleApiError } = useApiError();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [managerCandidates, setManagerCandidates] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [reactivateLoadingId, setReactivateLoadingId] = useState(null);
  const [statsTarget, setStatsTarget] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [branchesRes, candidatesRes] = await Promise.all([
        adminBranchesApi.listFull(),
        adminBranchesApi.getManagerCandidates(),
      ]);
      setBranches(branchesRes?.items || []);
      const { assigned = [], unassigned = [] } = candidatesRes || {};
      setManagerCandidates([...assigned, ...unassigned]);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách chi nhánh');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleEdit(branch) {
    setEditBranch(branch);
    setShowForm(true);
  }

  async function handleStats(branch) {
    setStatsTarget(branch);
    setStatsData(null);
    setStatsLoading(true);
    try {
      const data = await adminBranchesApi.getStats(branch.id);
      setStatsData(data);
    } catch {
      setStatsData(null);
    } finally {
      setStatsLoading(false);
    }
  }

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

  function handleFormSuccess() {
    toast.success(editBranch ? 'Cập nhật chi nhánh thành công' : 'Tạo chi nhánh mới thành công');
    setShowForm(false);
    setEditBranch(null);
    loadData();
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditBranch(null);
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
      <button className="btn btn--primary" onClick={() => { setEditBranch(null); setShowForm(true); }}>
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

      {/* Loading */}
      {loading && (
        <div className="admin-branches__loading">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>Đang tải danh sách chi nhánh...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="admin-branches__error">
          <IconAlert />
          <span>{error}</span>
          <button className="btn btn--secondary btn--sm" onClick={loadData}>Thử lại</button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Stats summary */}
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

          {/* Empty */}
          {branches.length === 0 ? (
            <div className="admin-branches__empty">
              <IconBranch />
              <p>Chưa có chi nhánh nào</p>
              <button className="btn btn--primary" onClick={() => setShowForm(true)}>
                Thêm chi nhánh đầu tiên
              </button>
            </div>
          ) : (
            <div className="admin-branches__cards">
              {branches.map((branch) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  onEdit={handleEdit}
                  onDeactivate={(b) => setDeactivateTarget(b)}
                  onReactivate={handleReactivate}
                  onStats={handleStats}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showForm && (
        <BranchFormModal
          branch={editBranch}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
          managerCandidates={managerCandidates}
        />
      )}

      {deactivateTarget && (
        <ConfirmDeactivateModal
          branch={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={handleDeactivate}
          loading={deactivateLoading}
        />
      )}

      {statsTarget && (
        <StatsModal
          branch={statsTarget}
          stats={statsLoading ? null : statsData}
          onClose={() => { setStatsTarget(null); setStatsData(null); }}
        />
      )}
    </div>
  );
}
