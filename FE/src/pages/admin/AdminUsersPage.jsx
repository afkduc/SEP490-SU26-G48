import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers';
import { useSharedBranches } from '../../contexts/SharedDataContext';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import { usePermission } from '../../contexts';
import {
  adminUsersApi,
} from '../../services/adminApi';
import { downloadBlob } from '../../utils/downloadBlob';
import { formatPhoneDisplay } from '../../utils/validation';
import { navigateWithCrm, forceCrmBrowserUrl, repairMissingCrmPrefix } from '../../utils/crmUrl';
import { getCrmPrefix } from '../../config';
import { useToast } from '../../components/common/ToastContext';
import PermissionGate from '../../components/PermissionGate';
import AdminPagination from './components/AdminPagination';
import TableSkeleton from './components/TableSkeleton';
import './AdminUsersPage.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Không hoạt động' },
];

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Không hoạt động',
};

const STATUS_CLASS = {
  active: 'badge--success',
  inactive: 'badge--danger',
};

function getInitials(firstName, lastName) {
  if (firstName || lastName) {
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
  }
  return '?';
}

/**
 * Action menu rieng cho mobile (3 cham / popup) de tranh tran bang.
 */
function UserActionMenu({ user, onView, onEdit }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="user-action-menu" ref={ref}>
      <button
        type="button"
        className="user-action-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Them thao tac"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="user-action-menu__dropdown" role="menu">
          <button type="button" onClick={() => { setOpen(false); onView(); }} role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Chi tiet
          </button>
          <PermissionGate permission="admin:users:update">
            <button type="button" onClick={() => { setOpen(false); onEdit(); }} role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Sua
            </button>
          </PermissionGate>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const { can } = usePermission();
  const { set403Error } = useGlobalError();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialMount = useRef(true);

  const {
    data,
    loading,
    error,
    params,
    setParams,
    updateParam,
    refresh,
  } = useAdminUsers();

  const { branches, roles, branchesLoading, rolesLoading, branchesError, rolesError } = useSharedBranches();

  const [localBranches, setLocalBranches] = useState([]);
  const [localRoles, setLocalRoles] = useState([]);

  useEffect(() => {
    if (branches && branches.length > 0) setLocalBranches(branches);
  }, [branches]);

  useEffect(() => {
    if (roles && roles.length > 0) setLocalRoles(roles);
  }, [roles]);

  const [searchParams] = useSearchParams();
  const [togglingId, setTogglingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const hasReadPermission = can('admin:users:read');

  // Xóa tab=roles cũ trên URL (màn vai trò đã bỏ)
  useEffect(() => {
    if (searchParams.get('tab') !== 'roles') return;
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    const qs = next.toString();
    navigate({ pathname: '/admin/users', search: qs ? `?${qs}` : '' }, { replace: true });
    forceCrmBrowserUrl('/admin/users', qs ? `?${qs}` : '');
  }, [searchParams, navigate]);

  // Không gọi setState trong render — chuyển sang effect (tránh vỡ hooks / action buttons)
  useEffect(() => {
    if (!hasReadPermission) {
      set403Error('admin:users:read', 'Bạn không có quyền truy cập trang quản lý người dùng.');
    }
  }, [hasReadPermission, set403Error]);

  // Đồng bộ filter → URL. Ép cứng /crm (không phụ thuộc helper có chạy hay không).
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const urlParams = {};
      if (searchParams.get('search')) urlParams.search = searchParams.get('search');
      if (searchParams.get('branchId')) urlParams.branchId = Number(searchParams.get('branchId'));
      if (searchParams.get('roleId')) urlParams.roleId = Number(searchParams.get('roleId'));
      if (searchParams.get('status')) urlParams.status = searchParams.get('status');
      if (searchParams.get('page')) urlParams.page = Number(searchParams.get('page'));
      if (Object.keys(urlParams).length > 0) {
        setParams((p) => ({ ...p, ...urlParams }));
      }
      return;
    }

    const next = new URLSearchParams();
    if (params.search) next.set('search', params.search);
    if (params.branchId) next.set('branchId', String(params.branchId));
    if (params.roleId) next.set('roleId', String(params.roleId));
    if (params.status) next.set('status', params.status);
    if (params.page > 1) next.set('page', String(params.page));
    const qs = next.toString();
    const search = qs ? `?${qs}` : '';

    // 1) Sync React Router
    navigate({ pathname: '/admin/users', search }, { replace: true });

    // 2) Ghi thẳng URL trình duyệt với prefix CRM (prod: /crm)
    const prefix = getCrmPrefix(); // prod luôn '/crm'
    const browserUrl = `${prefix}/admin/users${search}`;
    const nativeReplace = window.__crmNativeReplaceState
      || window.history.replaceState.bind(window.history);
    nativeReplace(window.history.state, '', browserUrl);

    // 3) Ép lại sau khi RR có thể ghi đè
    forceCrmBrowserUrl('/admin/users', search);
    repairMissingCrmPrefix();
    const t0 = setTimeout(() => {
      nativeReplace(window.history.state, '', browserUrl);
      repairMissingCrmPrefix();
    }, 0);
    const t1 = setTimeout(() => {
      nativeReplace(window.history.state, '', browserUrl);
    }, 100);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.search, params.branchId, params.roleId, params.status, params.page, navigate]);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      navigateWithCrm(navigate, '/admin/users/new', {
        replace: true,
        state: { fromListSearch: location.search },
      });
    }
  }, [searchParams, navigate, location.search]);

  useEffect(() => {
    if (location.pathname === '/admin/users' && !location.search) {
      setParams((p) => ({ ...p, page: 1 }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  function resetFilters() {
    setParams(() => ({
      search: '',
      branchId: undefined,
      roleId: undefined,
      status: undefined,
      page: 1,
    }));
  }

  function handlePageChange(page) {
    updateParam('page', page);
  }

  if (!hasReadPermission) {
    return null;
  }

  async function handleToggleStatus(userId, newStatus) {
    const isDeactivate = newStatus === 'inactive';
    const confirmMsg = isDeactivate
      ? 'Khóa tài khoản này? User sẽ không thể đăng nhập. (Không có chức năng xóa tài khoản.)'
      : 'Kích hoạt lại tài khoản này?';
    if (!window.confirm(confirmMsg)) return;

    setTogglingId(userId);
    try {
      await adminUsersApi.update({ userId, status: newStatus });
      toast.success(isDeactivate ? 'Đã khóa tài khoản' : 'Đã kích hoạt tài khoản');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await adminUsersApi.exportUsers(params);
      downloadBlob(blob, 'users.xlsx');
    } catch (err) {
      setExportError(err.message || 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }

  const totalPages = data.total > 0 ? Math.ceil(data.total / (data.pageSize || 10)) : 1;
  const currentPage = data.page || 1;

  return (
    <div className="admin-page admin-users">
      {/* Header */}
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <div className="admin-page__title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="admin-page__title-group">
            <h1>Người dùng</h1>
            <p className="admin-page__subtitle">
              Quản lý tài khoản và phân vai trò trên hồ sơ người dùng
            </p>
          </div>
        </div>
        <div className="admin-page__actions">
            <span className="admin-page__total-badge" title="Tổng số người dùng">
              {loading ? '...' : data.total} tài khoản
            </span>
            <button
              className="btn btn--secondary admin-page__btn-icon-text"
              onClick={handleExportExcel}
              disabled={exporting || loading}
              title="Xuất danh sách người dùng"
              aria-label="Xuất Excel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span className="admin-page__btn-label">{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>
            <PermissionGate permission="admin:users:create">
              <button
                className="btn btn--primary admin-page__btn-icon-text"
                onClick={() => navigate('/admin/users/new', { state: { fromListSearch: location.search } })}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span className="admin-page__btn-label">Tạo người dùng</span>
              </button>
            </PermissionGate>
          </div>
        {exportError && (
          <div className="admin-users__error" style={{ marginTop: 12, width: '100%' }}>
            <strong>Xuất Excel thất bại:</strong> {exportError}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-row">
          <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo tên, email, SĐT (có/không dấu)..."
            value={params.search || ''}
            onChange={(e) => updateParam('search', e.target.value)}
          />

          <select
            className="input input--select"
            value={params.branchId ?? ''}
            onChange={(e) =>
              updateParam('branchId', e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={!!branchesError}
          >
            <option value="">
              {(branchesError || branchesLoading) ? `Đang tải...` : 'Tất cả chi nhánh'}
            </option>
            {localBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.branchName}</option>
            ))}
          </select>

          <select
            className="input input--select"
            value={params.roleId ?? ''}
            onChange={(e) => updateParam('roleId', e.target.value || undefined)}
            disabled={!!rolesError}
          >
            <option value="">
              {(rolesError || rolesLoading) ? `Đang tải...` : 'Tất cả vai trò'}
            </option>
            {localRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.roleLabel || r.roleName}</option>
            ))}
          </select>

          <select
            className="input input--select"
            value={params.status ?? ''}
            onChange={(e) => updateParam('status', e.target.value || undefined)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button className="btn btn--ghost filter-row__reset" onClick={resetFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-card__header">
          <div className="table-card__title">Danh sách người dùng</div>
        </div>

        {loading && data.total === 0 ? (
          <TableSkeleton columns={['Người dùng', 'Chi nhánh', 'Vai trò', 'Trạng thái', 'Hành động']} />
        ) : error ? (
          <div className="admin-users__error">
            <strong>Lỗi:</strong> {error.message || 'Không thể tải danh sách'}
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="table admin-users__table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Chi nhánh</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th className="table__actions-col">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data.items || data.items.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="table__empty">
                        Không có người dùng nào phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    data.items.map((u) => (
                      <tr key={u.id}>
                        <td data-label="Người dùng">
                          <div className="user-name-row">
                            <div className="user-avatar">
                              {getInitials(u.firstName, u.lastName)}
                            </div>
                            <div className="user-name-cell">
                              <span className="user-name-cell__main">
                                {u.firstName && u.lastName
                                  ? `${u.firstName} ${u.lastName}`
                                  : u.name || '—'}
                              </span>
                              <span className="user-name-cell__sub">
                                <span className="font-mono">@{u.name}</span>
                                {u.phone ? ` · ${formatPhoneDisplay(u.phone)}` : ''}
                              </span>
                              {u.email ? (
                                <span className="user-name-cell__email" title={u.email}>
                                  {u.email}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td data-label="Chi nhánh">
                          {u.scopeAllBranches ? (
                            <span
                              className="badge badge--branch"
                              title="Người dùng quản lý tất cả chi nhánh"
                            >
                              Tất cả chi nhánh
                            </span>
                          ) : u.branchName ? (
                            <span className="badge badge--branch">
                              {u.branchName}
                            </span>
                          ) : (
                            <span className="user-table__empty">—</span>
                          )}
                        </td>
                        <td data-label="Vai trò">
                          {u.roles?.length > 0 ? (
                            <div className="user-table__roles">
                              {u.roles.map((r) => {
                                const name = typeof r === 'object' && r !== null ? r.roleName : r;
                                const key = typeof r === 'object' && r !== null ? r.roleId : r;
                                return (
                                  <span key={key} className="badge badge--info" title={name}>
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="user-table__empty">—</span>
                          )}
                        </td>
                        <td data-label="Trạng thái">
                          <div className="user-status-cell">
                            <span className={`badge ${STATUS_CLASS[u.status] || ''}`}>
                              {STATUS_LABELS[u.status] || u.status}
                            </span>
                            <button
                              type="button"
                              className={`badge admin-users__toggle-badge ${
                                u.status === 'active' ? 'badge--danger' : 'badge--success'
                              }`}
                              title={u.status === 'active' ? 'Khóa tài khoản' : 'Kích hoạt lại tài khoản'}
                              onClick={() => handleToggleStatus(u.id, u.status === 'active' ? 'inactive' : 'active')}
                              disabled={togglingId === u.id}
                            >
                              {togglingId === u.id ? '...' : (u.status === 'active' ? 'Khóa' : 'Kích hoạt')}
                            </button>
                          </div>
                        </td>
                        <td className="admin-users__actions-cell" data-label="Hành động">
                          <div className="action-btns">
                            <button
                              type="button"
                              className="btn btn--sm btn--view"
                              onClick={() => navigate(`/admin/users/${u.id}`, { state: { fromListSearch: location.search } })}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              <span>Chi tiết</span>
                            </button>
                            <PermissionGate permission="admin:users:update">
                              <button
                                type="button"
                                className="btn btn--sm btn--edit"
                                onClick={() => navigate(`/admin/users/${u.id}/edit`, { state: { fromListSearch: location.search } })}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                <span>Sửa</span>
                              </button>
                            </PermissionGate>
                          </div>
                          <UserActionMenu
                            user={u}
                            onView={() => navigate(`/admin/users/${u.id}`, { state: { fromListSearch: location.search } })}
                            onEdit={() => navigate(`/admin/users/${u.id}/edit`, { state: { fromListSearch: location.search } })}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data.total > 0 && (
              <AdminPagination
                currentPage={currentPage}
                totalPages={totalPages}
                total={data.total}
                onChange={handlePageChange}
                loading={loading}
                accent="indigo"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
