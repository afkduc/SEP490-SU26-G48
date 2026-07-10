import { useEffect, useState } from 'react';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers';
import {
  adminBranchesApi,
  adminRolesApi,
} from '../../services/adminApi';
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

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
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

  // Tai dropdown options (branches, roles) - chi load 1 lan khi mount
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
        if (!cancelled) setBranchesError(err.message || 'Khong tai duoc danh sach chi nhanh');
      }
      try {
        const rRes = await adminRolesApi.list();
        if (!cancelled) {
          setRoles(rRes?.items || []);
          setRolesError(null);
        }
      } catch (err) {
        if (!cancelled) setRolesError(err.message || 'Khong tai duoc danh sach role');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function applyFilters(e) {
    e?.preventDefault();
    // Hook tu dong call API khi params thay doi, nen khong can submit handler
  }

  function resetFilters() {
    setParams((p) => ({
      ...p,
      search: '',
      branchId: undefined,
      roleId: undefined,
      status: undefined,
      page: 1,
    }));
  }

  function handlePageChange(nextPage) {
    updateParam('page', nextPage);
  }

  return (
    <div className="admin-users">
      <div className="admin-users__header">
        <div>
          <h1 className="admin-users__title">Quan ly nguoi dung</h1>
          <p className="admin-users__subtitle">
            Danh sach tai khoan tren he thong (chi admin)
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="admin-users__filters" onSubmit={applyFilters}>
        <input
          className="input input--search"
          type="text"
          placeholder="Tim theo ten, email, so dien thoai..."
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
            <option key={b.id} value={b.id}>
              {b.branchName}
            </option>
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
            <option key={r.id} value={r.roleName}>
              {r.roleName}
            </option>
          ))}
        </select>

        <select
          className="input input--select"
          value={params.status ?? ''}
          onChange={(e) => updateParam('status', e.target.value || undefined)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button type="submit" className="btn btn--secondary">Loc</button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={resetFilters}
        >
          Dat lai
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="admin-users__loading">Dang tai danh sach nguoi dung...</div>
      ) : error ? (
        <div className="admin-users__error">
          Loi: {error.message || 'Khong the tai danh sach'}
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ten dang nhap</th>
                  <th>Ho va ten</th>
                  <th>Email</th>
                  <th>So dien thoai</th>
                  <th>Chi nhanh</th>
                  <th>Role</th>
                  <th>Trang thai</th>
                  <th>Dang nhap cuoi</th>
                </tr>
              </thead>
              <tbody>
                {(!data.items || data.items.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="table__empty">
                      Khong co nguoi dung nao phu hop
                    </td>
                  </tr>
                ) : (
                  data.items.map((u) => (
                    <tr key={u.id}>
                      <td><span className="font-mono">#{u.id}</span></td>
                      <td>{u.name || u.userName || '—'}</td>
                      <td>{u.fullName || '—'}</td>
                      <td>{u.email}</td>
                      <td>{u.phone || '—'}</td>
                      <td>{u.branchName || '—'}</td>
                      <td>
                        {(u.roles && u.roles.length > 0) ? (
                          u.roles.map((r) => (
                            <span key={r} className="badge badge--info" style={{ marginRight: 4 }}>
                              {r}
                            </span>
                          ))
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_CLASS[u.status] || ''}`}>
                          {STATUS_LABELS[u.status] || u.status}
                        </span>
                      </td>
                      <td className="font-mono admin-users__date">
                        {formatDateTime(u.lastLoginAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="admin-users__pagination">
            <span className="admin-users__pagination-info">
              Tong: <strong>{data.total}</strong> nguoi dung
              {data.total > 0 && (
                <>
                  {' '}— Trang <strong>{data.page}</strong> /{' '}
                  {Math.max(1, Math.ceil(data.total / (data.pageSize || 10)))}
                </>
              )}
            </span>
            <div className="admin-users__pagination-buttons">
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => handlePageChange(Math.max(1, (data.page || 1) - 1))}
                disabled={(data.page || 1) <= 1}
              >
                ← Truoc
              </button>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => handlePageChange((data.page || 1) + 1)}
                disabled={
                  !data.total ||
                  data.page >= Math.ceil(data.total / (data.pageSize || 10))
                }
              >
                Sau →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}