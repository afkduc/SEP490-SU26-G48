import { useEffect, useState } from 'react';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers';
import {
  adminUsersApi,
  adminBranchesApi,
  adminRolesApi,
} from '../../services/adminApi';
import UserFormModal from './users/UserFormModal';
import UserDetailDrawer from './users/UserDetailDrawer';
import './AdminUsersPage.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Tat ca trang thai' },
  { value: 'active', label: 'Hoat dong' },
  { value: 'inactive', label: 'Ngung hoat dong' },
  { value: 'locked', label: 'Bi khoa' },
];

const STATUS_LABELS = {
  active: 'Hoat dong',
  inactive: 'Ngung hoat dong',
  locked: 'Bi khoa',
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
  } = useAdminUsers();

  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branchesError, setBranchesError] = useState(null);
  const [rolesError, setRolesError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [detailUserId, setDetailUserId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

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
        if (!cancelled) setBranchesError(err.message || 'Khong tai danh sach chi nhanh');
      }
      try {
        const rRes = await adminRolesApi.list();
        if (!cancelled) {
          setRoles(rRes?.items || []);
          setRolesError(null);
        }
      } catch (err) {
        if (!cancelled) setRolesError(err.message || 'Khong tai danh sach role');
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
      setParams((p) => ({ ...p }));
    } catch (_) {
    } finally {
      setTogglingId(null);
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
            <h1>Quan ly nguoi dung</h1>
            <p className="admin-users__subtitle">
              Danh sach tai khoan he thong
            </p>
          </div>
        </div>
        <div className="admin-users__actions">
          {data.total > 0 && (
            <span className="admin-users__total-badge">{data.total} tai khoan</span>
          )}
          <button
            className="btn btn--primary"
            onClick={() => { setEditUser(null); setShowModal(true); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Tao nguoi dung moi
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-row">
          <input
            className="input input--search"
            type="text"
            placeholder="Tim theo ten, email, ho, ten..."
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
              {branchesError ? `Loi: ${branchesError}` : 'Tat ca chi nhanh'}
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
              {rolesError ? `Loi: ${rolesError}` : 'Tat ca role'}
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
            Dat lai
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-card__header">
          <div className="table-card__title">Danh sach nguoi dung</div>
        </div>

        {loading ? (
          <div className="admin-users__loading">Dang tai danh sach...</div>
        ) : error ? (
          <div className="admin-users__error">
            <strong>Loi:</strong> {error.message || 'Khong the tai danh sach'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nguoi dung</th>
                    <th>Email</th>
                    <th>Chi nhanh</th>
                    <th>Role</th>
                    <th>Trang thai</th>
                    <th>Ngay tao</th>
                    <th style={{ textAlign: 'right' }}>Hanh dong</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data.items || data.items.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="table__empty">
                        Khong co nguoi dung nao phu hop voi bo loc
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
                              {u.roles.map((r) => (
                                <span key={r} className="badge badge--info">{r}</span>
                              ))}
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
                              title={u.status === 'active' ? 'Khoa tai khoan' : 'Mo khoa tai khoan'}
                              onClick={() => handleToggleStatus(u.id, u.status === 'active' ? 'inactive' : 'active')}
                              disabled={togglingId === u.id}
                            >
                              {togglingId === u.id ? '...' : (u.status === 'active' ? 'Khoa' : 'Mo')}
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
                              Chi tiet
                            </button>
                            <button
                              className="btn btn--sm btn--edit"
                              onClick={() => { setEditUser(u); setShowModal(true); }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Sua
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
              <div className="pagination">
                <span className="pagination__info">
                  Tong <strong>{data.total}</strong> tai khoan
                  &nbsp;— Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
                </span>
                <div className="pagination__controls">
                  <button
                    className="pagination__nav-btn"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Truoc
                  </button>

                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`pagination__page-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="pagination__nav-btn"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Sau
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <UserFormModal
          user={editUser}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSuccess={() => setParams((p) => ({ ...p }))}
        />
      )}

      {detailUserId && (
        <UserDetailDrawer
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
        />
      )}
    </div>
  );
}
