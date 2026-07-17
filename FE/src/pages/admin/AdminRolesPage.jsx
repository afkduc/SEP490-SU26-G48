import { useEffect, useState } from 'react';
import { adminRolesApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import './AdminRolesPage.css';

// ─── Icons ────────────────────────────────────────────────────────────

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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

const IconMatrix = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}>
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconAlert = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ─── Helpers ────────────────────────────────────────────────────────

function getInitials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function groupPermissionsByModule(permissions) {
  const groups = {};
  for (const p of permissions) {
    if (!groups[p.module]) groups[p.module] = [];
    groups[p.module].push(p);
  }
  return groups;
}

// ─── Role Form Modal ──────────────────────────────────────────────

function RoleFormModal({ role, onClose, onSuccess }) {
  const isEdit = Boolean(role?.id);
  const [form, setForm] = useState({ roleName: role?.roleName || '', roleLabel: role?.roleLabel || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.roleName.trim()) { setError('Tên vai trò là bắt buộc'); return; }
    if (!form.roleLabel.trim()) { setError('Nhãn hiển thị là bắt buộc'); return; }

    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await adminRolesApi.update(role.id, { roleLabel: form.roleLabel.trim() });
      } else {
        await adminRolesApi.create({ roleName: form.roleName.trim(), roleLabel: form.roleLabel.trim() });
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu vai trò');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="role-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="role-modal">
        <div className="role-modal__header">
          <h2 className="role-modal__title">{isEdit ? 'Chỉnh sửa vai trò' : 'Thêm vai trò mới'}</h2>
          <button className="role-modal__close" onClick={onClose} type="button"><IconX /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="role-modal__body">
            <div className="form-group">
              <label>Tên vai trò (mã) <span>*</span></label>
              <input
                type="text"
                value={form.roleName}
                onChange={(e) => set('roleName', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="VD: quality_inspector"
                maxLength={50}
                required
                disabled={isEdit}
              />
              <p className="form-hint">Mã hệ thống, chỉ chữ thường và dấu gạch dưới, không đổi được sau khi tạo</p>
            </div>
            <div className="form-group">
              <label>Nhãn hiển thị <span>*</span></label>
              <input
                type="text"
                value={form.roleLabel}
                onChange={(e) => set('roleLabel', e.target.value)}
                placeholder="VD: Kiểm tra chất lượng"
                required
              />
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}
          </div>
          <div className="role-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo vai trò'}
            </button>
          </div>
        </form>
              </div>
              </div>
  );
}

// ─── Role Users Modal ────────────────────────────────────────────

function RoleUsersModal({ role, users, onClose }) {
  return (
    <div className="role-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="role-modal" style={{ maxWidth: '520px' }}>
        <div className="role-modal__header">
          <h2 className="role-modal__title">Người dùng có vai trò "{role?.roleLabel}"</h2>
          <button className="role-modal__close" onClick={onClose} type="button"><IconX /></button>
              </div>
        <div className="role-modal__body">
          {users.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>Không có người dùng nào</p>
          ) : (
            <div className="role-users-list">
              {users.map((u) => (
                <div key={u.id} className="role-user-item">
                  <div className="role-user-avatar">{getInitials(u.displayName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="role-user-name">{u.displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.email}</div>
              </div>
                  {u.branchName && <span className="role-user-branch">{u.branchName}</span>}
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    color: u.status === 'active' ? '#16a34a' : '#dc2626',
                    background: u.status === 'active' ? '#dcfce7' : '#fee2e2',
                    padding: '2px 8px', borderRadius: '4px',
                  }}>
                    {u.status === 'active' ? 'Hoạt động' : 'Khóa'}
                </span>
              </div>
              ))}
            </div>
          )}
        </div>
        <div className="role-modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ─── Role Card ──────────────────────────────────────────────────

function RoleCard({ role, onEdit, onToggleStatus, onUsers }) {
  return (
    <div className={`role-card ${role.isActive ? '' : 'role-card--inactive'}`}>
      <div className="role-card__header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span className={`role-card__badge ${role.isActive ? '' : 'role-card__badge--inactive'}`}>
              {role.roleName}
            </span>
            <span className={`role-card__status-chip ${role.isActive ? 'role-card__status-chip--active' : 'role-card__status-chip--inactive'}`}>
              {role.isActive ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="role-card__name">{role.roleLabel}</div>
        </div>
      </div>
      <div className="role-card__meta">
        <span className="role-card__meta-item">
          <IconUsers />
          {role.userCount ?? 0} người dùng
        </span>
      </div>
      <div className="role-card__actions">
        <button className="btn btn--sm btn--secondary" onClick={() => onUsers(role)} title="Xem người dùng">
          <IconUsers /> Người dùng
        </button>
        <button className="btn btn--sm btn--secondary" onClick={() => onEdit(role)} title="Chỉnh sửa">
          <IconEdit /> Sửa
        </button>
        <button
          className={`btn btn--sm ${role.isActive ? 'btn--warning' : 'btn--success-outline'}`}
          onClick={() => onToggleStatus(role)}
          title={role.isActive ? 'Tắt vai trò' : 'Kích hoạt vai trò'}
        >
          {role.isActive ? 'Tắt' : 'Kích hoạt'}
        </button>
      </div>
    </div>
  );
}

// ─── Permission Matrix ───────────────────────────────────────────

function PermissionMatrix({ roles, permissions, rolePermissions, onChange, onSave, saving, dirty }) {
  const grouped = groupPermissionsByModule(permissions);

  function isChecked(roleId, permId) {
    const perms = rolePermissions[roleId] || [];
    return perms.includes(permId);
  }

  function toggle(roleId, permId) {
    const perms = rolePermissions[roleId] || [];
    const next = perms.includes(permId)
      ? perms.filter((p) => p !== permId)
      : [...perms, permId];
    onChange(roleId, next);
  }

  return (
    <div className="matrix-container">
      <div className="matrix-header">
        <h2>Ma trận quyền — Vai trò &amp; Quyền</h2>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {permissions.length} quyền · {roles.length} vai trò
        </span>
      </div>

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Vai trò</th>
              {Object.entries(grouped).map(([module, perms]) =>
                perms.map((p) => (
                  <th key={p.id} title={`${p.resource}:${p.action}`}>
                    {p.action}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>
                  <div>{role.roleLabel}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>{role.roleName}</div>
                </td>
                {Object.entries(grouped).map(([module, perms]) =>
                  perms.map((p) => (
                    <td key={p.id}>
                      <input
                        type="checkbox"
                        className="matrix-checkbox"
                        checked={isChecked(role.id, p.id)}
                        onChange={() => toggle(role.id, p.id)}
                        title={`${role.roleLabel} — ${p.permissionKey}`}
                      />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dirty && (
        <div className="matrix-save-bar">
          <span className="matrix-save-bar__info">
            Đã thay đổi. Nhấn "Lưu" để cập nhật tất cả vai trò cùng lúc.
          </span>
          <div className="matrix-save-bar__actions">
            <button className="btn btn--secondary btn--sm" onClick={onSave} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────

export default function AdminRolesPage() {
  const toast = useToast();
  const [tab, setTab] = useState('list'); // 'list' | 'matrix'

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Matrix data
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({}); // { roleId: [permId, ...] }
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [usersModal, setUsersModal] = useState(null); // { role, users }

  async function loadRoles() {
    setLoading(true);
    setError('');
    try {
      const data = await adminRolesApi.list();
      setRoles(data?.items || []);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách vai trò');
    } finally {
      setLoading(false);
    }
  }

  async function loadMatrix() {
    setMatrixLoading(true);
    try {
      const [permsRes, rolesRes] = await Promise.all([
        adminRolesApi.listPermissions(),
        adminRolesApi.list(),
      ]);
      setPermissions(permsRes?.items || []);
      const rolesList = rolesRes?.items || [];

      // Load role permissions sequentially to avoid overwhelming DB
      const permsByRole = {};
      await Promise.all(
        rolesList.map(async (role) => {
          try {
            const res = await adminRolesApi.getRolePermissions(role.id);
            permsByRole[role.id] = (res?.items || []).map((p) => p.id);
          } catch {
            permsByRole[role.id] = [];
          }
        })
      );
      setRolePermissions(permsByRole);
    } catch (err) {
      console.error('Matrix load error:', err);
    } finally {
      setMatrixLoading(false);
    }
  }

  useEffect(() => { loadRoles(); }, []);
  useEffect(() => { if (tab === 'matrix' && permissions.length === 0) loadMatrix(); }, [tab]);

  function handleMatrixChange(roleId, permIds) {
    setRolePermissions((prev) => ({ ...prev, [roleId]: permIds }));
    setMatrixDirty(true);
  }

  async function handleMatrixSave() {
    setMatrixSaving(true);
    try {
      const roleList = roles;
      await Promise.all(
        roleList.map(async (role) => {
          const permIds = rolePermissions[role.id] || [];
          await adminRolesApi.setRolePermissions(role.id, permIds);
        })
      );
      setMatrixDirty(false);
    } catch (err) {
      toast.error('Lỗi khi lưu: ' + (err.message || 'Không rõ'));
    } finally {
      setMatrixSaving(false);
    }
  }

  async function handleToggleStatus(role) {
    try {
      await adminRolesApi.toggleStatus(role.id);
      toast.success('Cập nhật trạng thái thành công');
      loadRoles();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  }

  async function handleUsersModal(role) {
    try {
      const data = await adminRolesApi.getRoleUsers(role.id);
      setUsersModal({ role, users: data?.items || [] });
    } catch {
      setUsersModal({ role, users: [] });
    }
  }

  return (
    <div className="admin-roles">
      {/* Header */}
      <div className="admin-roles__header">
        <div className="admin-roles__title-block">
          <div className="admin-roles__title-icon"><IconShield /></div>
          <div className="admin-roles__title-group">
            <h1>Vai trò &amp; Quyền hạn</h1>
            <p className="admin-roles__subtitle">Quản lý vai trò, phân quyền và ma trận quyền hạn</p>
          </div>
        </div>
        <div className="admin-roles__actions">
          {roles.length > 0 && (
            <span className="admin-roles__total-badge">{roles.length} vai trò</span>
          )}
          <button className="btn btn--primary" onClick={() => { setEditRole(null); setShowForm(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Thêm vai trò
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-roles__tabs">
        <button
          className={`admin-roles__tab ${tab === 'list' ? 'admin-roles__tab--active' : ''}`}
          onClick={() => setTab('list')}
        >
          Danh sách vai trò
        </button>
        <button
          className={`admin-roles__tab ${tab === 'matrix' ? 'admin-roles__tab--active' : ''}`}
          onClick={() => setTab('matrix')}
        >
          Ma trận quyền
        </button>
      </div>

      {/* Tab: List */}
      {tab === 'list' && (
        <>
          {loading && (
            <div className="admin-roles__loading">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
              <span>Đang tải...</span>
        </div>
      )}

          {error && !loading && (
            <div className="admin-roles__error">
              <IconAlert />
              <span>{error}</span>
              <button className="btn btn--secondary btn--sm" onClick={loadRoles}>Thử lại</button>
        </div>
      )}

          {!loading && !error && roles.length === 0 && (
            <div className="admin-roles__empty">
              <IconShield />
              <p>Chưa có vai trò nào</p>
              <button className="btn btn--primary" onClick={() => setShowForm(true)}>Thêm vai trò đầu tiên</button>
            </div>
          )}

          {!loading && !error && roles.length > 0 && (
            <div className="admin-roles__cards">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onEdit={(r) => { setEditRole(r); setShowForm(true); }}
                  onToggleStatus={handleToggleStatus}
                  onUsers={handleUsersModal}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Matrix */}
      {tab === 'matrix' && (
        <>
          {matrixLoading ? (
            <div className="admin-roles__loading">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span>Đang tải quyền hạn...</span>
            </div>
          ) : (
            permissions.length > 0 && (
              <PermissionMatrix
                roles={roles}
                permissions={permissions}
                rolePermissions={rolePermissions}
                onChange={handleMatrixChange}
                onSave={handleMatrixSave}
                saving={matrixSaving}
                dirty={matrixDirty}
              />
            )
          )}
        </>
      )}

      {/* Modals */}
      {showForm && (
        <RoleFormModal
          role={editRole}
          onClose={() => { setShowForm(false); setEditRole(null); }}
          onSuccess={() => {
            toast.success(editRole ? 'Cập nhật vai trò thành công' : 'Tạo vai trò mới thành công');
            setShowForm(false);
            setEditRole(null);
            loadRoles();
          }}
        />
      )}

      {usersModal && (
        <RoleUsersModal
          role={usersModal.role}
          users={usersModal.users}
          onClose={() => setUsersModal(null)}
        />
      )}
    </div>
  );
}
