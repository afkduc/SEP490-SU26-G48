import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { permissionMatrixApi, roleScreenMatrixApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import usePermissionEventsSSE from '../../hooks/admin/usePermissionEventsSSE';
import './AdminPermissionMatrixPage.css';

// ─── Icons ────────────────────────────────────────────────────────────

const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
  </svg>
);

const IconAlert = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ─── Permission Cell (checkbox) ────────────────────────────────────

function PermissionCell({ granted, loading, onToggle, disabled }) {
  return (
    <button
      type="button"
      className={`perm-cell ${granted ? 'perm-cell--granted' : 'perm-cell--denied'} ${loading ? 'perm-cell--loading' : ''}`}
      onClick={onToggle}
      disabled={disabled || loading}
      title={granted ? 'Đã cấp quyền - click để thu hồi' : 'Chưa cấp quyền - click để cấp'}
    >
      {loading ? <span className="perm-cell__spinner" /> : granted ? <IconCheck /> : <IconX />}
    </button>
  );
}

// ─── Role Table (1 role x N screens) ───────────────────────────────

/**
 * Derive scope cua 1 role tu grants + screens API.
 * KHONG hardcode module - scope duoc tinh tu data that:
 *   - Ten role (vi role thuong quan ly module = ten no)
 *   - Token dau tien cua moi permissionKey da grant (vd "manager:services" -> "manager")
 *   - Token giua trong "screen:X:access" -> X
 *
 * Mot screen thuoc scope cua role neu:
 *   - screen.module thuoc scope, HOAC
 *   - permissionKey co token thuoc scope (tru 'screen' module L1)
 *
 * Vi du role "technician" co grants: dashboard, repair-orders, technician:tasks
 *   -> scope = {technician, dashboard, repair-orders, screen}
 *   -> chi hien thi permission lien quan den cac token nay.
 * Role moi chua co grant gi -> scope = {roleName} -> chi hien thi permission module roleName.
 */
function deriveRoleScope(role, grants, screens, roleScreenKeys) {
  const tokens = new Set();
  // Token luon chua roleName (vd 'manager', 'technician') de fallback khi DB
  // chua co screen access tuong ung.
  tokens.add(role.roleName);
  // L1 + L2b grants (da bao gom ca role_screen_permissions screen_keys khi co bit)
  // Vi du:
  //   'screen:manager:services:access' -> tokens.add('manager')
  //   'manager:services'               -> tokens.add('manager')  (L2b screen_key)
  //   'advisor:customers'              -> tokens.add('advisor')
  //   'dashboard'                      -> tokens.add('dashboard')
  for (const g of grants) {
    if (g.roleId !== role.id) continue;
    const pk = g.permissionKey || '';
    if (!pk) continue;
    const parts = pk.split(':');
    if (parts[0] === 'screen' && parts.length >= 3) {
      tokens.add(parts[1]);
    } else if (parts.length >= 2) {
      tokens.add(parts[0]);
    } else {
      tokens.add(parts[0]);
    }
  }
  // L2 role_screen_permissions: day la cache prefill co 105 keys cho moi role.
  // KHONG dung de derive scope (se lam "scope" qua rong, filter vo hieu).
  // Nho dao nguoc: chi nhung row CO BIT = true moi tin cay.
  // Hien tai BE getGrants() da union L2b screen_keys (chi khi set bits qua role_permissions),
  // nen khong can dung roleScreenKeys o day.
  return tokens;
}

/**
 * Kiem tra 1 screen co thuoc scope cua role khong.
 * Voi admin role -> luon true (scope = toan bo).
 * Voi role thuong: screen thuoc scope neu:
 *   - screen.module thuoc scope tokens, HOAC
 *   - permissionKey co token thuoc scope tokens (tru 'screen' L1)
 */
function isScreenInScope(screen, scopeTokens, isAdmin) {
  if (isAdmin) return true;
  if (!screen || !screen.permissionKey) return false;
  // Wildcard '*' chi danh cho admin -> loai voi role thuong
  if (screen.permissionKey === '*') return false;
  if (scopeTokens.has(screen.module)) return true;
  const parts = screen.permissionKey.split(':');
  if (parts[0] === 'screen' && parts.length >= 3) {
    return scopeTokens.has(parts[1]);
  }
  if (parts.length >= 2) {
    return scopeTokens.has(parts[0]);
  }
  return scopeTokens.has(parts[0]);
}

// 3 actions chuan cua moi screen (user yeu cau).
// Mapping tu auto-discovered action:
//   view (GET) -> read
//   edit (PUT/PATCH) -> update
//   create (POST) -> create
const ACTION_LIST = [
  { key: 'canView', label: 'View', icon: '👁', action: 'view' },
  { key: 'canCreate', label: 'Create', icon: '➕', action: 'create' },
  { key: 'canUpdate', label: 'Edit', icon: '✏️', action: 'edit' },
];

// Derive 2D matrix (screens x actions) cho 1 role tu data API (screensByRole).
// Bao gom:
//   - Anh xa screen (module:resource) -> danh sach 3 actions view/edit/create
//   - access (L1) + 5 action bits (L2)
//   - availableActions (route that co trong controller)
//   - Filter scope (roleName -> tokens tu grants)
function buildScreenActionMatrix(role, screensWithPerms, isAdmin, scope) {
  const items = [];
  for (const s of screensWithPerms) {
    const screenKey = s.screenKey;
    // Filter scope cho role thuong: chi hien thi screen thuoc scope
    if (!isAdmin) {
      const inScope = scope.has(s.module) || scope.has(screenKey);
      if (!inScope) continue;
    }
    items.push({
      screenKey,
      module: s.module,
      resource: s.resource,
      hasAccess: !!s.hasAccess,
      actions: {
        canView: !!s.canView,
        canCreate: !!s.canCreate,
        canUpdate: !!s.canUpdate,
      },
      availableActions: {
        view: !!(s.availableActions && s.availableActions.view),
        create: !!(s.availableActions && s.availableActions.create),
        edit: !!(s.availableActions && (s.availableActions.update)),
      },
    });
  }
  return items;
}

function RoleTable({ role, screenPermissions, scope, isAdmin, actionMap, onToggleAction, onToggleAllActions, onToggleAllForRole, pendingForRole, expandedScreens, onToggleExpand }) {
  // Build 2D matrix da filter scope
  const matrix = useMemo(() => {
    return buildScreenActionMatrix(role, screenPermissions, isAdmin, scope);
  }, [role, screenPermissions, scope, isAdmin]);

  // Dem actions duoc grant
  const stats = useMemo(() => {
    let total = 0;
    let granted = 0;
    for (const item of matrix) {
      for (const a of ACTION_LIST) {
        if (item.availableActions[a.action]) {
          total++;
          if (item.actions[a.key]) granted++;
        }
      }
    }
    return { total, granted };
  }, [matrix]);

  if (matrix.length === 0) {
    const hasPending = pendingForRole && pendingForRole.size > 0;
    return (
      <section className={`role-table role-table--empty ${isAdmin ? 'role-table--admin' : ''} ${hasPending ? 'role-table--has-pending' : ''}`}>
        <header className="role-table__header">
          <div className="role-table__title-row">
            <h3 className="role-table__title">{role.roleLabel || role.roleName}</h3>
            {isAdmin && <span className="role-table__badge">FULL ACCESS</span>}
            {hasPending && <span className="role-table__pending-badge">● {pendingForRole.size} chưa lưu</span>}
          </div>
          <div className="role-table__meta">
            <span className="role-table__role-name">{role.roleName}</span>
            <span className="role-table__counter">0/0 quyền</span>
          </div>
        </header>
        <div className="role-table__body">
          <div className="role-table__empty">Vai trò này chưa có quyền nào trong hệ thống.</div>
        </div>
      </section>
    );
  }

  const hasPending = pendingForRole && pendingForRole.size > 0;
  return (
    <section className={`role-table ${isAdmin ? 'role-table--admin' : ''} ${hasPending ? 'role-table--has-pending' : ''}`}>
      <header className="role-table__header">
        <div className="role-table__title-row">
          <h3 className="role-table__title">{role.roleLabel || role.roleName}</h3>
          {isAdmin && <span className="role-table__badge">FULL ACCESS</span>}
          {hasPending && <span className="role-table__pending-badge">● {pendingForRole.size} chưa lưu</span>}
        </div>
        <div className="role-table__meta">
          <span className="role-table__role-name">{role.roleName}</span>
          <span className="role-table__counter">
            {stats.granted}/{stats.total} quyền chi tiết
          </span>
          {/* Toggle "Toàn quyền" cho role - toggle tất cả actions của tất cả screens.
              Chi toggle cac action available (auto-discovered). Neu tat ca da duoc grant,
              nut se revoke toan bo. */}
          {!isAdmin && matrix.length > 0 && stats.total > 0 && (
            <label
              className={`role-table__toggle-all ${stats.granted === stats.total ? 'role-table__toggle-all--active' : ''}`}
              title={stats.granted === stats.total ? 'Bỏ chọn tất cả quyền của vai trò này' : 'Chọn tất cả quyền của vai trò này'}
            >
              <input
                type="checkbox"
                checked={stats.granted === stats.total}
                onChange={() => onToggleAllForRole(role, screenPermissions, stats.granted !== stats.total)}
              />
              <span className="role-table__toggle-all-label">Toàn quyền</span>
            </label>
          )}
        </div>
      </header>

      <div className="role-table__body">
        <ul className="role-table__list role-table__list--2d">
          {matrix.map((item) => {
            const screenKey = item.screenKey;
            const expandKey = `${role.id}:${screenKey}`;
            const isExpanded = expandedScreens.has(expandKey);
            const accessKey = `screen:${screenKey}:access`;
            const isAccessGranted = actionMap.has(`${role.id}:${accessKey}`);
            const isAccessPending = pendingForRole && pendingForRole.has(`${role.id}:${accessKey}`);
            const anyActionActive = item.actions.canView || item.actions.canCreate || item.actions.canUpdate;
            const visibleActions = ACTION_LIST.filter((a) => item.availableActions[a.action]);
            return (
              <li
                key={screenKey}
                className={`role-table__row ${isAccessGranted ? 'role-table__row--granted' : ''} ${isAccessPending ? 'role-table__row--pending' : ''}`}
              >
                <div className="role-table__row-head">
                  <button
                    type="button"
                    className="role-table__row-toggle"
                    onClick={() => onToggleExpand(expandKey)}
                    title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                  >
                    <span className={`role-table__row-arrow ${isExpanded ? 'role-table__row-arrow--open' : ''}`}>▸</span>
                  </button>
                  <div className="role-table__row-info">
                    <span className="role-table__row-label">{screenKey}</span>
                    <span className="role-table__row-meta">{item.module} · {item.resource}</span>
                  </div>
                  <div className="role-table__row-summary">
                    {anyActionActive ? (
                      <span className="role-table__row-counter">
                        {visibleActions.filter((a) => item.actions[a.key]).length}/{visibleActions.length} actions
                      </span>
                    ) : (
                      <span className="role-table__row-counter role-table__row-counter--empty">0 actions</span>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="role-table__row-actions">
                    {visibleActions.length === 0 ? (
                      <div className="role-table__row-actions-empty">
                        Màn này chưa có route hành động nào trong controller.
                      </div>
                    ) : (
                      <>
                        {/* Toggle all 5 actions cua screen nay */}
                        <label
                          className="role-table__row-toggle-all"
                          title={visibleActions.every((a) => item.actions[a.key]) ? 'Bỏ chọn tất cả action của màn này' : 'Chọn tất cả action của màn này'}
                        >
                          <input
                            type="checkbox"
                            checked={visibleActions.every((a) => item.actions[a.key])}
                            onChange={() => {
                              const allGranted = visibleActions.every((a) => item.actions[a.key]);
                              onToggleAllActions(role.id, screenKey, !allGranted);
                            }}
                          />
                          <span>Tất cả</span>
                        </label>
                        <div className="role-table__row-actions-grid">
                          {visibleActions.map((action) => {
                            const actionKey = `${role.id}:${screenKey}:${action.action}`;
                            const isGranted = !!item.actions[action.key];
                            const isPending = pendingForRole && pendingForRole.has(actionKey);
                            const isLoading = actionMap.has(actionKey + '|loading');
                            return (
                              <label
                                key={action.action}
                                className={`role-table__action ${isGranted ? 'role-table__action--granted' : ''} ${isPending ? 'role-table__action--pending' : ''} ${isLoading ? 'role-table__action--loading' : ''}`}
                              >
                                <span className="role-table__action-icon">{action.icon}</span>
                                <span className="role-table__action-label">{action.label}</span>
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  disabled={isLoading}
                                  onChange={() => onToggleAction(role.id, screenKey, action.key, action.action, !isGranted)}
                                />
                                {isPending && (
                                  <span className="role-table__action-pending" title="Thay đổi chưa lưu">●</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
// ─── Main Page ─────────────────────────────────────────────────────

export default function AdminPermissionMatrixPage() {
  const toast = useToast();
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // pendingChanges: Map<key, {roleId, permissionKey, granted, originalGranted, type}>
  //   key = `${roleId}:${permissionKey}`
  //   type = 'permission' (L1 + L2 - permissions table) hoặc 'action' (L2 - role_screen_permissions)
  const [pendingChanges, setPendingChanges] = useState(() => new Map());
  const [saving, setSaving] = useState(false);
  const [expandedScreens, setExpandedScreens] = useState(() => new Set());
  // Ref de tranh stale closure khi SSE callback chay sau khi component unmount.
  const matrixRef = useRef(matrix);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permissionMatrixApi.getMatrix();
      setMatrix(data);
      matrixRef.current = data;
      // Khi reload (sau khi SSE hoac save thanh cong), clear pendingChanges
      // de tranh ghi de du lieu moi tren giao dien.
      setPendingChanges(new Map());
    } catch (err) {
      toast.error(err.message || 'Lỗi tải ma trận quyền');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  /**
   * SSE: lang nghe permission-changed tu server.
   */
  usePermissionEventsSSE({
    enabled: true,
    onPermissionChanged: (data) => {
      const isMatrixUpdate = data?.action === 'matrix_updated';
      const roles = Array.isArray(data?.roleIds) ? data.roleIds : [];
      toast.info(
        isMatrixUpdate
          ? `Ma tran quyen vua duoc cap nhat (${roles.length} role${roles.length > 1 ? 's' : ''}) - tu dong reload.`
          : 'Quyen cua ban vua duoc cap nhat.'
      );
      loadMatrix();
    },
  });

  // baseGrantSet goc tu API: key = `${roleId}:${permissionKey}` (L1 + L2 permissions table)
  const baseGrantSet = useMemo(() => {
    if (!matrix) return new Set();
    return new Set(
      matrix.grants
        .filter((g) => g.permissionKey)
        .map((g) => `${g.roleId}:${g.permissionKey}`)
    );
  }, [matrix]);

  // baseActionMap goc tu API: key = `${roleId}:${screenKey}:${action}`
  // Action keys: canView, canCreate, canUpdate, canDelete, canExport
  const baseActionMap = useMemo(() => {
    const m = new Map();
    if (!matrix?.screensByRole) return m;
    for (const role of matrix.roles) {
      const screens = matrix.screensByRole[role.id] || [];
      for (const s of screens) {
        if (s.canView) m.set(`${role.id}:${s.screenKey}:view`, true);
        if (s.canCreate) m.set(`${role.id}:${s.screenKey}:create`, true);
        if (s.canUpdate) m.set(`${role.id}:${s.screenKey}:update`, true);
        if (s.canDelete) m.set(`${role.id}:${s.screenKey}:delete`, true);
        if (s.canExport) m.set(`${role.id}:${s.screenKey}:export`, true);
      }
    }
    return m;
  }, [matrix]);

  // effective: base + pending
  const actionMap = useMemo(() => {
    const next = new Map(baseActionMap);
    for (const [key, change] of pendingChanges.entries()) {
      if (change.type === 'action') {
        if (change.granted) next.set(key, true);
        else next.delete(key);
      }
    }
    return next;
  }, [baseActionMap, pendingChanges]);

  const grantSet = useMemo(() => {
    const next = new Set(baseGrantSet);
    for (const [key, change] of pendingChanges.entries()) {
      if (change.type === 'permission') {
        if (change.granted) next.add(key);
        else next.delete(key);
      }
    }
    return next;
  }, [baseGrantSet, pendingChanges]);

  /**
   * Khi user toggle 1 action (view/edit/create) cua (role, screenKey).
   * pendingChange.type = 'action'.
   * key = `${roleId}:${screenKey}:${action}` (action la 'view'|'create'|'update')
   */
  const handleToggleAction = useCallback((roleId, screenKey, actionKey, action, granted) => {
    const key = `${roleId}:${screenKey}:${action}`;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const original = baseActionMap.has(key);
      if (granted === original) {
        next.delete(key);
      } else {
        next.set(key, {
          roleId,
          type: 'action',
          screenKey,
          actionKey,
          action,
          granted,
          originalGranted: original,
        });
      }
      return next;
    });
  }, [baseActionMap]);

  /**
   * Toggle permission L1/`permissionKey` (cũ - permissions table).
   * Van giu de backward-compatible.
   */
  const handleTogglePermission = useCallback((roleId, permissionKey, granted) => {
    const key = `${roleId}:${permissionKey}`;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const original = baseGrantSet.has(key);
      if (granted === original) {
        next.delete(key);
      } else {
        next.set(key, {
          roleId,
          type: 'permission',
          permissionKey,
          granted,
          originalGranted: original,
        });
      }
      return next;
    });
  }, [baseGrantSet]);

  /**
   * Toggle 1 section (cac action cua 1 screen) qua bulk API.
   * Su dung PUT /api/admin/role-screen-matrix?roleId=X.
   */
  /**
   * Toggle tat ca 5 actions cua 1 (role, screen) cung luc.
   * Chi update pendingChanges - KHONG goi API truc tiep. Sau do user bam
   * "Luu tat ca" o dau trang de commit.
   *
   * @param {number} roleId
   * @param {string} screenKey  (vd 'advisor:customers')
   * @param {boolean} granted   trang thai mong muon cua TAT CA 5 actions
   */
  const handleToggleAllActions = useCallback((roleId, screenKey, granted) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const ACTIONS = ['view', 'create', 'update', 'delete', 'export'];
      for (const action of ACTIONS) {
        const key = `${roleId}:${screenKey}:${action}`;
        const original = baseActionMap.has(key);
        if (granted === original) {
          // Ve trang thai goc -> xoa khoi pending (neu co).
          next.delete(key);
        } else {
          next.set(key, {
            roleId,
            type: 'action',
            screenKey,
            actionKey: `${action}`.charAt(0).toUpperCase() + action.slice(1),
            action,
            granted,
            originalGranted: original,
          });
        }
      }
      return next;
    });
  }, [baseActionMap]);

  /**
   * Toggle tat ca 5 actions cua TAT CA screen cua 1 role (grant toan quyen cho role).
   * Chi update pendingChanges - KHONG goi API truc tiep.
   *
   * @param {object} role
   * @param {boolean} granted
   */
  const handleToggleAllForRole = useCallback((role, screenPermissions, granted) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const ACTIONS = ['view', 'create', 'update', 'delete', 'export'];
      for (const screen of screenPermissions) {
        const screenKey = screen.screenKey;
        // Chi toggle nhung action available (auto-discovered routes co action do)
        const available = screen.availableActions || {};
        for (const action of ACTIONS) {
          if (!available[action]) continue;
          const key = `${role.id}:${screenKey}:${action}`;
          const original = baseActionMap.has(key);
          if (granted === original) {
            next.delete(key);
          } else {
            next.set(key, {
              roleId: role.id,
              type: 'action',
              screenKey,
              actionKey: action.charAt(0).toUpperCase() + action.slice(1),
              action,
              granted,
              originalGranted: original,
            });
          }
        }
      }
      return next;
    });
  }, [baseActionMap]);

  /**
   * Luu toan bo pendingChanges:
   *  - Gop permission changes goi PATCH /api/admin/permission-matrix/bulk.
   *  - Gop action changes goi PUT /api/admin/role-screen-matrix?roleId=X.
   */
  const handleSaveAll = useCallback(async () => {
    if (pendingChanges.size === 0 || saving) return;
    setSaving(true);
    try {
      const permChanges = [];
      const actionChangesByRole = new Map(); // roleId -> array of {screenKey, canView, canCreate, canUpdate, canDelete, canExport}

      for (const c of pendingChanges.values()) {
        if (c.type === 'permission') {
          permChanges.push({
            roleId: c.roleId,
            permissionKey: c.permissionKey,
            granted: c.granted,
          });
        } else if (c.type === 'action') {
          if (!actionChangesByRole.has(c.roleId)) actionChangesByRole.set(c.roleId, new Map());
          const byScreen = actionChangesByRole.get(c.roleId);
          if (!byScreen.has(c.screenKey)) {
            // Snapshot tu baseActionMap de apply delta
            byScreen.set(c.screenKey, {
              screenKey: c.screenKey,
              canView: !!baseActionMap.get(`${c.roleId}:${c.screenKey}:view`),
              canCreate: !!baseActionMap.get(`${c.roleId}:${c.screenKey}:create`),
              canUpdate: !!baseActionMap.get(`${c.roleId}:${c.screenKey}:update`),
              canDelete: !!baseActionMap.get(`${c.roleId}:${c.screenKey}:delete`),
              canExport: !!baseActionMap.get(`${c.roleId}:${c.screenKey}:export`),
            });
          }
          const item = byScreen.get(c.screenKey);
          // Map action -> field
          if (c.action === 'view') item.canView = !!c.granted;
          else if (c.action === 'create') item.canCreate = !!c.granted;
          else if (c.action === 'update') item.canUpdate = !!c.granted;
          else if (c.action === 'delete') item.canDelete = !!c.granted;
          else if (c.action === 'export') item.canExport = !!c.granted;
        }
      }

      // Call permission bulk
      let totalAffectedUsers = 0;
      if (permChanges.length > 0) {
        const result = await permissionMatrixApi.bulkToggle(permChanges);
        const failed = Array.isArray(result?.results)
          ? result.results.filter((r) => r && !r.ok)
          : [];
        if (failed.length > 0) {
          throw new Error(`Có ${failed.length} quyền không thể cập nhật`);
        }
        totalAffectedUsers += Number(result?.affectedUserCount) || 0;
      }

      // Call role-screen-matrix per role
      for (const [roleId, byScreen] of actionChangesByRole.entries()) {
        const items = Array.from(byScreen.values());
        const result = await roleScreenMatrixApi.saveMatrix(roleId, items);
        totalAffectedUsers += Number(result?.affectedUserCount) || 0;
      }

      // Thong bao: bao nhieu user dang online se bi tac dong ngay lap tuc
      if (totalAffectedUsers > 0) {
        toast.success(
          `Đã lưu ${pendingChanges.size} thay đổi phân quyền. ` +
          `${totalAffectedUsers} người dùng đang online sẽ được cập nhật trong vài giây.`
        );
      } else {
        toast.success(`Đã lưu ${pendingChanges.size} thay đổi phân quyền`);
      }
      await loadMatrix();
    } catch (err) {
      toast.error(err.message || 'Lỗi lưu thay đổi');
    } finally {
      setSaving(false);
    }
  }, [pendingChanges, saving, toast, loadMatrix, baseActionMap]);

  const handleCancelChanges = useCallback(() => {
    setPendingChanges((prev) => (prev.size === 0 ? prev : new Map()));
    toast.info('Đã hủy các thay đổi');
  }, [toast]);

  const pendingStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const change of pendingChanges.values()) {
      if (change.granted) added++;
      else removed++;
    }
    return { added, removed, total: pendingChanges.size };
  }, [pendingChanges]);

  // pendingByRole: Map<roleId, Set<key>>
  const pendingByRole = useMemo(() => {
    const next = new Map();
    for (const [key, change] of pendingChanges.entries()) {
      if (!next.has(change.roleId)) next.set(change.roleId, new Set());
      next.get(change.roleId).add(key);
    }
    return next;
  }, [pendingChanges]);

  const toggleExpand = useCallback((expandKey) => {
    setExpandedScreens((prev) => {
      const next = new Set(prev);
      if (next.has(expandKey)) next.delete(expandKey);
      else next.add(expandKey);
      return next;
    });
  }, []);

  // Filter screensByRole theo search
  const filteredScreenByRole = useMemo(() => {
    if (!matrix?.screensByRole) return {};
    if (!search.trim()) return matrix.screensByRole;
    const q = search.trim().toLowerCase();
    const next = {};
    for (const roleId of Object.keys(matrix.screensByRole)) {
      next[roleId] = matrix.screensByRole[roleId].filter((s) =>
        (s.screenKey || '').toLowerCase().includes(q) ||
        (s.module || '').toLowerCase().includes(q) ||
        (s.resource || '').toLowerCase().includes(q)
      );
    }
    return next;
  }, [matrix?.screensByRole, search]);

  if (loading && !matrix) {
    return (
      <div className="matrix-page">
        <div className="matrix-loading">
          <span className="matrix-loading__spinner" />
          <span>Đang tải ma trận quyền...</span>
        </div>
      </div>
    );
  }

  if (!matrix || !matrix.roles?.length) {
    return (
      <div className="matrix-page">
        <div className="matrix-empty">
          <IconAlert />
          <h3>Chưa có dữ liệu ma trận quyền</h3>
          <p>Vui lòng chạy file SQL <code>seed_screen_permission_matrix.sql</code> trước, hoặc liên hệ quản trị viên hệ thống.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="matrix-page">
      <header className="matrix-page__header">
        <div className="matrix-page__title-row">
          <span className="matrix-page__icon"><IconShield /></span>
          <div>
            <h1 className="matrix-page__title">Phân quyền truy cập theo vai trò</h1>
            <p className="matrix-page__subtitle">
              Mỗi vai trò chỉ hiển thị các màn hình liên quan đến công việc của họ.
              Bấm vào từng màn hình để chọn 3 chức năng <strong>View / Create / Edit</strong>.
              Tick chọn nhiều quyền rồi nhấn <strong>Lưu thay đổi</strong> để áp dụng.
            </p>
          </div>
        </div>

        <div className="matrix-page__actions">
          <input
            type="search"
            className="matrix-page__search"
            placeholder="Tìm theo màn hình (module:resource)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="matrix-page__refresh" onClick={loadMatrix} disabled={loading || saving}>
            <IconRefresh /> Tải lại
          </button>
        </div>
      </header>

      {/* Sticky Save Bar - luon o dau trang, chi hien khi co pending changes.
          Su dung position: sticky de luon nhin thay khi scroll xuong cac role. */}
      {pendingStats.total > 0 && (
        <div className="matrix-page__bulk-bar" role="region" aria-label="Thay đổi chưa lưu">
          <div className="matrix-page__bulk-info">
            <span className="matrix-page__bulk-pulse" aria-hidden="true">●</span>
            <strong>{pendingStats.total}</strong> thay đổi chưa lưu
            <span className="matrix-page__bulk-stats">
              <span className="matrix-page__bulk-stat--added">+{pendingStats.added} cấp</span>
              {pendingStats.removed > 0 && (
                <span className="matrix-page__bulk-stat--removed">−{pendingStats.removed} thu hồi</span>
              )}
            </span>
            {pendingByRole.size > 0 && (
              <span className="matrix-page__bulk-by-role">
                {Array.from(pendingByRole.entries()).slice(0, 3).map(([rid, keys]) => {
                  const r = matrix.roles.find((x) => x.id === rid);
                  return (
                    <span key={rid} className="matrix-page__bulk-role-tag">
                      {r?.roleLabel || r?.roleName || `#${rid}`}: {keys.size}
                    </span>
                  );
                })}
                {pendingByRole.size > 3 && (
                  <span className="matrix-page__bulk-role-tag">+{pendingByRole.size - 3} role khác</span>
                )}
              </span>
            )}
          </div>
          <div className="matrix-page__bulk-actions">
            <button
              type="button"
              className="matrix-page__cancel-btn"
              onClick={handleCancelChanges}
              disabled={saving}
            >
              Hủy tất cả
            </button>
            <button
              type="button"
              className="matrix-page__save-btn"
              onClick={handleSaveAll}
              disabled={saving || pendingStats.total === 0}
            >
              {saving ? (
                <>
                  <span className="matrix-page__save-spinner" />
                  Đang lưu và áp dụng...
                </>
              ) : (
                <>
                  <IconCheck />
                  Lưu {pendingStats.total} thay đổi & Áp dụng
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {pendingStats.total === 0 && matrix && (
        <div className="matrix-page__bulk-hint">
          💡 <strong>Mẹo:</strong> Tick chọn nhiều quyền liên tục, sau đó nhấn <strong>Lưu</strong> ở thanh phía trên để áp dụng cho toàn bộ vai trò.
          Thay đổi sẽ có hiệu lực <strong>ngay lập tức</strong> cho tất cả người dùng đang online.
        </div>
      )}

      <div className="matrix-page__grid">
        {matrix.roles.map((role) => {
          const roleScope = deriveRoleScope(role, matrix.grants || [], matrix.screens || [], matrix.roleScreenKeys || {});
          const screenPermissions = filteredScreenByRole[role.id] || [];
          return (
            <RoleTable
              key={role.id}
              role={role}
              screenPermissions={screenPermissions}
              scope={roleScope}
              isAdmin={role.roleName === 'admin'}
              actionMap={actionMap}
              onToggleAction={handleToggleAction}
              onToggleAllActions={handleToggleAllActions}
              onToggleAllForRole={handleToggleAllForRole}
              pendingForRole={pendingByRole.get(role.id)}
              expandedScreens={expandedScreens}
              onToggleExpand={toggleExpand}
            />
          );
        })}
      </div>

      <footer className="matrix-page__footer">
        <div className="matrix-page__legend">
          <span className="matrix-page__legend-item">
            <span className="perm-cell perm-cell--granted"><IconCheck /></span> = Đã cấp quyền
          </span>
          <span className="matrix-page__legend-item">
            <span className="perm-cell perm-cell--denied"><IconX /></span> = Chưa cấp
          </span>
        </div>
        <small>
          Tổng: <strong>{matrix.roles.length}</strong> roles.
          Cập nhật lúc: {new Date(matrix.generatedAt).toLocaleString('vi-VN')}
        </small>
      </footer>
    </div>
  );
}
