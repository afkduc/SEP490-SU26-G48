import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers';
import {
  adminUsersApi,
  adminBranchesApi,
  adminRolesApi,
} from '../../services/adminApi';
import { downloadBlob } from '../../utils/downloadBlob';
import UserFormModal from './users/UserFormModal';
import UserDetailDrawer from './users/UserDetailDrawer';
import AssignRoleModal from './users/AssignRoleModal';
import AdminPagination from './components/AdminPagination';
import './AdminUsersPage.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
  { value: 'locked', label: 'Bị khóa' },
];

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  locked: 'Bị khóa',
};

const STATUS_CLASS = {
  active: 'badge--success',
  inactive: 'badge--secondary',
  locked: 'badge--danger',
};

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function getInitials(firstName, lastName) {
  if (firstName || lastName) {
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
  }
  return '?';
}

export default function AdminUsersPage() {
  const {
    data,
    loading,
    error,
    params,
    setParams,
    updateParam,
    refresh,
  } = useAdminUsers();

  const [searchParams] = useSearchParams();
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branchesError, setBranchesError] = useState(null);
  const [rolesError, setRolesError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [detailUserId, setDetailUserId] = useState(null);
  const [assignUserId, setAssignUserId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowModal(true);
      setEditUser(null);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bRes = await adminBranchesApi.list();
        if (!cancelled) {
          setBranches(bRes?.items || []);
          setBranchesError(null);
        }
      } catch (err) {
        if (!cancelled) setBranchesError(err.message || 'Không tải được danh sách chi nhánh');
      }
      try {
        const rRes = await adminRolesApi.list();
        if (!cancelled) {
          setRoles(rRes?.items || []);
          setRolesError(null);
        }
      } catch (err) {
        if (!cancelled) setRolesError(err.message || 'Không tải được danh sách vai trò');
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  async function handleToggleStatus(userId, newStatus) {
    setTogglingId(userId);
    try {
      await adminUsersApi.update({ userId, status: newStatus });
      refresh();
    } catch (_) {
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
    <div className="admin-users">
      {/* Header */}
      <div className="admin-users__header">
        <div className="admin-users__title-block">
          <div className="admin-users__title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="admin-users__title-group">
            <h1>Quản lý người dùng</h1>
            <p className="admin-users__subtitle">
              Danh sách tài khoản hệ thống
            </p>
          </div>
        </div>
        <div className="admin-users__actions">
          {data.total > 0 && (
            <span className="admin-users__total-badge">{data.total} tài khoản</span>
          )}
          <button
            className="btn btn--secondary"
            onClick={handleExportExcel}
            disabled={exporting || loading}
            title="Xuất danh sách người dùng (theo bộ lọc hiện tại) ra file Excel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button
            className="btn btn--primary"
            onClick={() => { setEditUser(null); setShowModal(true); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Tạo người dùng mới
          </button>
        </div>
        {exportError && (
          <div className="admin-users__error" style={{ marginTop: 12 }}>
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
            placeholder="Tìm theo tên, email, họ, tên..."
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
              {branchesError ? `Lỗi: ${branchesError}` : 'Tất cả chi nhánh'}
            </option>
            {branches.map((b) => (
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
              {rolesError ? `Lỗi: ${rolesError}` : 'Tất cả vai trò'}
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.roleName}</option>
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

          <button className="btn btn--ghost" onClick={resetFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            Đặt lại
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-card__header">
          <div className="table-card__title">Danh sách người dùng</div>
        </div>

        {loading ? (
          <div className="admin-users__loading">Đang tải danh sách...</div>
        ) : error ? (
          <div className="admin-users__error">
            <strong>Lỗi:</strong> {error.message || 'Không thể tải danh sách'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Email</th>
                    <th>Chi nhánh</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: 'right' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data.items || data.items.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="table__empty">
                        Không có người dùng nào phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    data.items.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                                {u.phone ? ` · ${u.phone}` : ''}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{u.email || '—'}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{u.branchName || '—'}</td>
                        <td>
                          {u.roles?.length > 0 ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {u.roles.map((r) => {
                                const name = typeof r === 'object' && r !== null ? r.roleName : r;
                                return (
                                  <span key={typeof r === 'object' && r !== null ? r.roleId : r} className="badge badge--info">{name}</span>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          <div className="user-status-cell">
                            <span className={`badge ${STATUS_CLASS[u.status] || ''}`}>
                              {STATUS_LABELS[u.status] || u.status}
                            </span>
                            <button
                              className={`btn btn--sm ${u.status === 'active' ? 'btn--danger-ghost' : 'btn--success-ghost'} admin-users__toggle-btn`}
                              title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              onClick={() => handleToggleStatus(u.id, u.status === 'active' ? 'inactive' : 'active')}
                              disabled={togglingId === u.id}
                            >
                              {togglingId === u.id ? '...' : (u.status === 'active' ? 'Khóa' : 'Mở')}
                            </button>
                          </div>
                        </td>
                        <td className="admin-users__date">{formatDate(u.createdAt)}</td>
                        <td>
                          <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn--sm btn--view"
                              onClick={() => setDetailUserId(u.id)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              Chi tiết
                            </button>
                            <button
                              className="btn btn--sm btn--role"
                              onClick={() => setAssignUserId(u.id)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                              </svg>
                              Phân quyền
                            </button>
                            <button
                              className="btn btn--sm btn--edit"
                              onClick={() => { setEditUser(u); setShowModal(true); }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Sửa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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

      {showModal && (
        <UserFormModal
          user={editUser}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSuccess={() => refresh()}
        />
      )}

      {detailUserId && (
        <UserDetailDrawer
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onRolesChanged={() => refresh()}
        />
      )}

      {assignUserId && (
        <AssignRoleModal
          userId={assignUserId}
          onClose={() => setAssignUserId(null)}
          onSuccess={() => refresh()}
        />
      )}
    </div>
  );
}
