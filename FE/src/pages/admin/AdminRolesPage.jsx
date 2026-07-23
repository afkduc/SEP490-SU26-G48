import { useEffect, useState, Fragment } from 'react';
import { adminRolesApi, refreshPermissionsApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import { useAuth } from '../../contexts/AppContext';
import PermissionGate from '../../components/PermissionGate';
import { ROLE_VALUES } from '../../constants/roles';
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

// ─── Confirm Modal ──────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', variant = 'danger', onConfirm, onCancel }) {
  return (
    <div className="role-modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="role-modal" style={{ maxWidth: '420px' }}>
        <div className="role-modal__header">
          <h2 className="role-modal__title">{title}</h2>
          <button className="role-modal__close" onClick={onCancel} type="button"><IconX /></button>
        </div>
        <div className="role-modal__body">
          <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.55 }}>{body}</div>
        </div>
        <div className="role-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={`btn ${variant === 'danger' ? 'btn--warning' : 'btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Role Form Modal ──────────────────────────────────────────────

function RoleFormModal({ role, groups, byModule, onClose, onSuccess }) {
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
        const created = await adminRolesApi.create({ roleName: form.roleName.trim(), roleLabel: form.roleLabel.trim() });
        // Phase 3.3: auto-preset nhom quyen theo module tuong ung.
        // Neu role khong co trong ROLE_MODULE_MAP -> bo qua, admin tu tick sau.
        const moduleEntry = ROLE_MODULE_MAP[form.roleName.trim()];
        if (moduleEntry && moduleEntry !== 'all') {
          const newRoleId = created?.id ?? created?.item?.id ?? created?.roleId;
          const moduleGroups = byModule?.[moduleEntry] || [];
          const groupIds = moduleGroups.map((g) => g.id);
          if (newRoleId && groupIds.length > 0) {
            try {
              await adminRolesApi.setRoleGroups(newRoleId, groupIds);
            } catch (presetErr) {
              console.warn('[RoleFormModal] auto-preset groups fail:', presetErr);
              // Tiep tuc khong throw de modal van bao success (role da tao OK)
            }
          }
        }
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

function RoleCard({ role, onAction }) {
  return (
    <div className={`role-card ${role.isActive ? '' : 'role-card--inactive'}`}>
      <div className="role-card__header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span className={`role-card__badge ${role.isActive ? '' : 'role-card__badge--inactive'}`}>
              {role.roleName}
            </span>
            <span className={`role-card__status-chip ${role.isActive ? 'role-card__status-chip--active' : 'role-card__status-chip--inactive'}`}>
              {role.isActive ? 'Hoạt động' : 'Tắt'}
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
        <PermissionGate permission="admin:user_roles:read">
          <button className="btn btn--sm btn--secondary" onClick={() => onAction('users', role)} title="Xem người dùng">
            <IconUsers /> Người dùng
          </button>
        </PermissionGate>
        <PermissionGate permission="admin:roles:update">
          <button className="btn btn--sm btn--secondary" onClick={() => onAction('edit', role)} title="Chỉnh sửa">
            <IconEdit /> Sửa
          </button>
        </PermissionGate>
        <PermissionGate
          permission={role.isActive ? 'admin:roles:deactivate' : 'admin:roles:activate'}
        >
          <button
            className={`btn btn--sm ${role.isActive ? 'btn--warning' : 'btn--success-outline'}`}
            onClick={() => onAction('toggle', role)}
            title={role.isActive ? 'Tắt vai trò' : 'Kích hoạt vai trò'}
          >
            {role.isActive ? 'Tắt' : 'Kích hoạt'}
          </button>
        </PermissionGate>
      </div>
    </div>
  );
}

// ─── Group Matrix (Phase 3) - moi role = 1 card voi cac nhom checkbox ──

const MODULE_LABELS = {
  admin: 'Quản trị hệ thống',
  general_director: 'Giám đốc điều hành',
  manager: 'Quản lý chi nhánh',
  warehouse_staff: 'Nhân viên kho',
  service_advisor: 'Cố vấn dịch vụ',
  team_leader: 'Tổ trưởng kỹ thuật',
  technician: 'Kỹ thuật viên',
};

// Phase 3.3: Mapping roleName -> module. Admin thay tat ca cac module
// (vi admin co quyen gan nhom cho moi role), cac role khac chi thay 1 module
// tuong ung de tranh tick nham nhom cua role khac (vd: manager tick nhom admin).
const ROLE_MODULE_MAP = {
  admin: 'all',
  general_director: 'general_director',
  manager: 'manager',
  warehouse_staff: 'warehouse_staff',
  service_advisor: 'service_advisor',
  team_leader: 'team_leader',
  technician: 'technician',
};

function getModulesForRole(roleName) {
  const entry = ROLE_MODULE_MAP[roleName];
  if (!entry) return []; // role khong co mapping -> rong (can warning o ngoai)
  if (entry === 'all') return Object.keys(MODULE_LABELS); // admin thay tat ca
  return [entry];
}

function GroupMatrix({ roles, groups, byModule, roleGroupIds, onChange, onSave, saving, dirty }) {
  function isChecked(roleId, groupId) {
    return (roleGroupIds[roleId] || []).includes(groupId);
  }

  function toggle(roleId, groupId) {
    const current = roleGroupIds[roleId] || [];
    const next = current.includes(groupId)
      ? current.filter((g) => g !== groupId)
      : [...current, groupId];
    onChange(roleId, next);
  }

  function toggleAll(roleId, groupIdsInModule) {
    const current = roleGroupIds[roleId] || [];
    const moduleGroupIds = groupIdsInModule.map((g) => g.id);
    const allChecked = moduleGroupIds.length > 0 && moduleGroupIds.every((id) => current.includes(id));
    const next = allChecked
      ? current.filter((id) => !moduleGroupIds.includes(id))
      : Array.from(new Set([...current, ...moduleGroupIds]));
    onChange(roleId, next);
  }

  function isModuleAllChecked(roleId, moduleGroups) {
    const current = roleGroupIds[roleId] || [];
    if (moduleGroups.length === 0) return false;
    return moduleGroups.every((g) => current.includes(g.id));
  }

  return (
    <div className="groups-matrix">
      <div className="groups-matrix__header">
        <h2>Phân quyền theo nhóm — Vai trò &amp; Nhóm chức năng</h2>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {groups.length} nhóm · {roles.length} vai trò · Tick 1 nhóm = cấp toàn bộ quyền trong nhóm
        </span>
      </div>

      <div className="groups-matrix__cards">
        {roles.map((role) => {
          // Phase 3.3: moi role chi thay modules cua role do (admin thay tat ca)
          const moduleKeys = getModulesForRole(role.roleName);
          const noMapping = moduleKeys.length === 0;
          return (
          <div key={role.id} className={`groups-matrix__card ${role.isActive ? '' : 'groups-matrix__card--inactive'}`}>
            <div className="groups-matrix__card-header">
              <div>
                <div className="groups-matrix__role-name">{role.roleLabel}</div>
                <div className="groups-matrix__role-meta">
                  <span className="groups-matrix__role-code">{role.roleName}</span>
                  <span className={`groups-matrix__status ${role.isActive ? 'is-active' : 'is-inactive'}`}>
                    {role.isActive ? 'Hoạt động' : 'Tắt'}
                  </span>
                  <span className="groups-matrix__role-count">
                    {(roleGroupIds[role.id] || []).length} nhóm
                  </span>
                </div>
              </div>
            </div>

            {noMapping ? (
              <div className="groups-matrix__warning">
                Vai trò <code>{role.roleName}</code> chưa có ánh xạ module.
                Thêm vào <code>ROLE_MODULE_MAP</code> trong <code>AdminRolesPage.jsx</code>.
              </div>
            ) : (
            <div className="groups-matrix__modules">
              {moduleKeys.map((moduleKey) => {
                const moduleGroups = byModule[moduleKey] || [];
                if (moduleGroups.length === 0) return null;
                const allChecked = isModuleAllChecked(role.id, moduleGroups);
                const someChecked = moduleGroups.some((g) => (roleGroupIds[role.id] || []).includes(g.id));
                return (
                  <div key={moduleKey} className="groups-matrix__module">
                    <div className="groups-matrix__module-header">
                      <label className="groups-matrix__module-toggle">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                          onChange={() => toggleAll(role.id, moduleGroups)}
                        />
                        <span className="groups-matrix__module-name">
                          {MODULE_LABELS[moduleKey] || moduleKey}
                        </span>
                      </label>
                      <span className="groups-matrix__module-count">{moduleGroups.length} nhóm</span>
                    </div>

                    <div className="groups-matrix__group-list">
                      {moduleGroups.map((g) => {
                        const checked = isChecked(role.id, g.id);
                        const permCount = (g.permissionKeys || []).length;
                        return (
                          <label
                            key={g.id}
                            className={`groups-matrix__group ${checked ? 'is-checked' : ''}`}
                            title={g.groupLabel || g.groupName}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(role.id, g.id)}
                            />
                            <span className="groups-matrix__group-name">{g.groupName}</span>
                            <span className="groups-matrix__group-perms">
                              {permCount > 0 ? `${permCount} quyền` : '0 quyền'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          );
        })}
      </div>

      {dirty && (
        <div className="matrix-save-bar">
          <span className="matrix-save-bar__info">
            Đã thay đổi. Nhấn "Lưu" để cập nhật tất cả vai trò cùng lúc.
          </span>
          <div className="matrix-save-bar__actions">
            <PermissionGate permission="admin:roles:manage">
              <button className="btn btn--secondary btn--sm" onClick={onSave} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </PermissionGate>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Permission Matrix ───────────────────────────────────────────

function PermissionMatrix({ roles, visibleRoles, permissions, rolePermissions, onChange, onSave, saving, dirty }) {
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
          {permissions.length} quyền · {visibleRoles.length} vai trò
        </span>
      </div>

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="matrix-th--module">Quyền</th>
              {visibleRoles.map((role) => (
                <th key={role.id} title={`${role.roleLabel} (${role.roleName})`} className="matrix-th--role">
                  <div className="matrix-role-label">{role.roleLabel}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
              {Object.entries(grouped).map(([module, modulePerms]) => (
                <Fragment key={`mod-${module}`}>
                  <tr className="matrix-module-row">
                    <td colSpan={visibleRoles.length + 1} className="matrix-module-cell">
                      {module}
                    </td>
                  </tr>
                  {modulePerms.map((p) => (
                    <tr key={p.id} className="matrix-perm-row">
                      <td className="matrix-perm-label" title={`${p.resource}:${p.action}`}>
                        <span className="matrix-perm-action">{p.action}</span>
                        <span className="matrix-perm-key">{p.permissionKey}</span>
                      </td>
                      {visibleRoles.map((role) => (
                        <td key={role.id} className="matrix-check-cell">
                          <input
                            type="checkbox"
                            className="matrix-checkbox"
                            checked={isChecked(role.id, p.id)}
                            onChange={() => toggle(role.id, p.id)}
                            title={`${role.roleLabel} — ${p.permissionKey}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
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
            <PermissionGate permission="admin:roles:manage">
              <button className="btn btn--secondary btn--sm" onClick={onSave} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </PermissionGate>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────

export default function AdminRolesPage() {
  const toast = useToast();
  const { reloadPermissions } = useAuth();
  const [tab, setTab] = useState('list'); // 'list' | 'matrix' | 'groups'

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Matrix data (legacy)
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({}); // { roleId: [permId, ...] }
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);

  // Groups matrix data (Phase 3)
  const [groups, setGroups] = useState([]);
  const [groupsByModule, setGroupsByModule] = useState({});
  const [roleGroupIds, setRoleGroupIds] = useState({}); // { roleId: [groupId, ...] }
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsDirty, setGroupsDirty] = useState(false);
  const [groupsSaving, setGroupsSaving] = useState(false);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [usersModal, setUsersModal] = useState(null); // { role, users }
  const [confirmToggle, setConfirmToggle] = useState(null); // role dang can confirm toggle

  function handleRoleAction(action, role) {
    if (action === 'users') return handleUsersModal(role);
    if (action === 'edit') {
      setEditRole(role);
      setShowForm(true);
      return;
    }
    if (action === 'toggle') {
      // Neu role dang active va co user -> confirm truoc
      if (role.isActive && (role.userCount ?? 0) > 0) {
        setConfirmToggle(role);
      } else {
        doToggleStatus(role);
      }
    }
  }

  async function doToggleStatus(role) {
    try {
      await adminRolesApi.toggleStatus(role.id);
      toast.success('Cập nhật trạng thái thành công');
      loadRoles();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setConfirmToggle(null);
    }
  }

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
      const [permsRes, rolesFullRes] = await Promise.all([
        adminRolesApi.listPermissions(),
        adminRolesApi.listWithPermissions(),
      ]);
      setPermissions(permsRes?.items || []);
      const rolesList = rolesFullRes?.items || [];
      // Map permissionIds (number[]) vao state rolePermissions (1 call, khong N+1)
      const permsByRole = {};
      for (const r of rolesList) {
        permsByRole[r.id] = Array.isArray(r.permissionIds) ? r.permissionIds : [];
      }
      setRolePermissions(permsByRole);
    } catch (err) {
      console.error('Matrix load error:', err);
    } finally {
      setMatrixLoading(false);
    }
  }

  // Phase 3: Load groups + role-group mapping trong 1 luot
  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const groupsRes = await adminRolesApi.listPermissionGroups();
      const allGroups = groupsRes?.items || [];
      setGroups(allGroups);
      setGroupsByModule(groupsRes?.byModule || {});

      // Lay groupIds cho tung role (parallel - 1 roundtrip)
      const roleIds = roles.map((r) => r.id);
      const results = await Promise.all(
        roleIds.map((rid) => adminRolesApi.getRoleGroupIds(rid).catch(() => ({ roleId: rid, groupIds: [] })))
      );
      const mapping = {};
      for (const { roleId, groupIds } of results) {
        mapping[roleId] = Array.isArray(groupIds) ? groupIds : [];
      }
      setRoleGroupIds(mapping);
    } catch (err) {
      console.error('Groups load error:', err);
    } finally {
      setGroupsLoading(false);
    }
  }

  useEffect(() => { loadRoles(); }, []);
  useEffect(() => { if (tab === 'matrix') loadMatrix(); }, [tab]);
  useEffect(() => { if (tab === 'groups' && roles.length > 0) loadGroups(); }, [tab, roles.length]);

  // Matrix hien thi TAT CA roles (gồm system roles + custom roles).
  // Truoc day chi loc theo ROLE_VALUES -> custom roles bi an va khong luu duoc.
  // Giu lai ROLE_VALUES de highlight system roles voi style dac biet trong UI
  // (neu can). Hien tai matrix dung `visibleRoles` thay cho filter.
  const visibleRoles = roles;

  function handleMatrixChange(roleId, permIds) {
    setRolePermissions((prev) => ({ ...prev, [roleId]: permIds }));
    setMatrixDirty(true);
  }

  async function handleMatrixSave() {
    setMatrixSaving(true);
    try {
      const changes = visibleRoles.map((role) => ({
        roleId: role.id,
        permissionIds: rolePermissions[role.id] || [],
      }));
      // 1 bulk call thay vi Promise.all(setRolePermissions N lan)
      const result = await adminRolesApi.saveMatrix(changes);
      setMatrixDirty(false);

      // Refresh token với permissions mới từ DB
      // Neu refresh that bai -> chi warn, KHONG hien "thanh cong" gia
      // (BE da luu DB thanh cong nhung token con cu)
      let refreshOk = false;
      try {
        const refreshResult = await refreshPermissionsApi();
        if (refreshResult?.token || refreshResult?.permissions) {
          const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
          if (refreshResult.token) storage.setItem('token', refreshResult.token);
          if (refreshResult.permissions) {
            storage.setItem('permissions', JSON.stringify(refreshResult.permissions));
          }
          refreshOk = true;
        }
      } catch (err) {
        console.warn('[AdminRolesPage] refresh-permissions fail:', err);
      }

      if (refreshOk) {
        toast.success('Đã lưu ma trận quyền. Thay đổi có hiệu lực ngay.');
      } else {
        toast.warn('Đã lưu vào DB nhưng token chưa cập nhật. Vui lòng đăng nhập lại để thấy thay đổi quyền.');
      }
    } catch (err) {
      // Hien thi loi tu backend (vd: last-admin guard 409)
      toast.error('Lỗi khi lưu: ' + (err.message || 'Không rõ'));
    } finally {
      setMatrixSaving(false);
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

  function handleGroupsChange(roleId, groupIds) {
    setRoleGroupIds((prev) => ({ ...prev, [roleId]: groupIds }));
    setGroupsDirty(true);
  }

  async function handleGroupsSave() {
    setGroupsSaving(true);
    try {
      const changes = roles.map((role) => ({
        roleId: role.id,
        groupIds: roleGroupIds[role.id] || [],
      }));
      const result = await adminRolesApi.saveRoleGroupsMatrix(changes);
      setGroupsDirty(false);
      toast.success(`Đã lưu nhóm quyền cho ${result.updatedRoles} vai trò (${result.affectedUserCount} người dùng bị ảnh hưởng).`);

      // Reload permissions token để các user đang online refresh
      try {
        const refreshResult = await refreshPermissionsApi();
        if (refreshResult?.token || refreshResult?.permissions) {
          const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
          if (refreshResult.token) storage.setItem('token', refreshResult.token);
          if (refreshResult.permissions) {
            storage.setItem('permissions', JSON.stringify(refreshResult.permissions));
          }
          await reloadPermissions?.();
        }
      } catch (err) {
        console.warn('[AdminRolesPage] refresh-permissions after groups save failed:', err);
      }
    } catch (err) {
      toast.error('Lỗi khi lưu nhóm quyền: ' + (err.message || 'Không rõ'));
    } finally {
      setGroupsSaving(false);
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
          <PermissionGate permission="admin:roles:create">
            <button className="btn btn--primary" onClick={() => { setEditRole(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Thêm vai trò
            </button>
          </PermissionGate>
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
          className={`admin-roles__tab ${tab === 'groups' ? 'admin-roles__tab--active' : ''}`}
          onClick={() => setTab('groups')}
        >
          Phân quyền theo nhóm
        </button>
        <button
          className={`admin-roles__tab ${tab === 'matrix' ? 'admin-roles__tab--active' : ''}`}
          onClick={() => setTab('matrix')}
        >
          Ma trận quyền (chi tiết)
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
              <PermissionGate permission="admin:roles:create">
                <button className="btn btn--primary" onClick={() => setShowForm(true)}>Thêm vai trò đầu tiên</button>
              </PermissionGate>
            </div>
          )}

          {!loading && !error && roles.length > 0 && (
            <div className="admin-roles__cards">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onAction={handleRoleAction}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Groups (Phase 3) */}
      {tab === 'groups' && (
        <>
          {groupsLoading ? (
            <div className="admin-roles__loading">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span>Đang tải nhóm quyền...</span>
            </div>
          ) : (
            groups.length > 0 && (
              <GroupMatrix
                roles={roles}
                groups={groups}
                byModule={groupsByModule}
                roleGroupIds={roleGroupIds}
                onChange={handleGroupsChange}
                onSave={handleGroupsSave}
                saving={groupsSaving}
                dirty={groupsDirty}
              />
            )
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
                visibleRoles={visibleRoles}
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
          groups={groups}
          byModule={groupsByModule}
          onClose={() => { setShowForm(false); setEditRole(null); }}
          onSuccess={() => {
            const createdNew = !editRole;
            toast.success(editRole ? 'Cập nhật vai trò thành công' : 'Tạo vai trò mới thành công');
            setShowForm(false);
            setEditRole(null);
            loadRoles().then(async () => {
              // Phase 3.3: neu vua tao role moi, reload groups de UI hien thi auto-preset
              if (createdNew) {
                await loadGroups();
              }
            });
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

      {confirmToggle && (
        <ConfirmModal
          title={`Tắt vai trò "${confirmToggle.roleLabel}"?`}
          body={
            <div>
              <p style={{ margin: '0 0 8px' }}>
                Vai trò này đang có <strong>{confirmToggle.userCount}</strong> người dùng.
              </p>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
                Khi tắt, những người dùng này sẽ mất quyền tương ứng nhưng vẫn giữ tài khoản.
              </p>
            </div>
          }
          confirmLabel={`Tắt vai trò (${confirmToggle.userCount} người dùng)`}
          variant="danger"
          onConfirm={() => doToggleStatus(confirmToggle)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  );
}
