import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { permissionMatrixApi, roleScreenMatrixApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import usePermissionEventsSSE from '../../hooks/admin/usePermissionEventsSSE';
import { PermissionRequestsPanel } from './PermissionRequestsPage';
import permissionRequestApi from '../../services/permissionRequestApi';
import { getScreenLabel } from '../../utils/screenLabels';
import './AdminPermissionMatrixPage.css';
import './PermissionRequestsPage.css';

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
 * Chuan hoa permission/screen key de tim kiem:
 *   screen:director:branch_managers:access  -> director:branch_managers
 *   director:branch_managers                 -> director:branch_managers
 */
function normalizeScreenSearchTerm(raw = '') {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/^screen:/i, '');
  s = s.replace(/:access$/i, '');
  return s.trim();
}

/** Map role_name DB -> CHỈ các module màn hình thuộc role đó */
const ROLE_MODULE_ALIASES = {
  general_director: ['director'],
  service_advisor: ['advisor'],
  team_leader: ['leader'],
  warehouse_staff: ['inventory', 'warehouse'],
  manager: ['manager'],
  technician: ['technician'],
};

function getAllowedModulesForRole(roleName) {
  const aliases = ROLE_MODULE_ALIASES[roleName];
  if (aliases?.length) return new Set(aliases);
  return new Set([roleName]);
}

/** Screen chỉ thuộc role nếu module/prefix khớp alias của role (không lấy màn role khác). */
function isScreenOwnedByRole(screenKey, module, roleName) {
  const allowed = getAllowedModulesForRole(roleName);
  const mod = module || String(screenKey || '').split(':')[0];
  if (mod && allowed.has(mod)) return true;
  const key = String(screenKey || '');
  for (const m of allowed) {
    if (key === m || key.startsWith(`${m}:`)) return true;
  }
  return false;
}

// 5 action bits L2 (khớp role_screen_permissions + requireScreenAction).
// View là nền: phải bật View trước; tắt View → tắt hết quyền còn lại.
const ACTION_LIST = [
  { key: 'canView', label: 'View', icon: 'V', action: 'view' },
  { key: 'canCreate', label: 'Create', icon: 'C', action: 'create' },
  { key: 'canUpdate', label: 'Edit', icon: 'U', action: 'update' },
  { key: 'canDelete', label: 'Disable', icon: 'D', action: 'delete' },
  { key: 'canExport', label: 'Export', icon: 'E', action: 'export' },
];
const L2_OTHER_ACTIONS = ['create', 'update', 'delete', 'export'];

/** Ghi / xóa 1 pending action theo so sánh với base. */
function upsertActionPending(next, baseActionMap, roleId, screenKey, action, granted) {
  const key = `${roleId}:${screenKey}:${action}`;
  const original = baseActionMap.has(key);
  if (granted === original) {
    next.delete(key);
  } else {
    next.set(key, {
      roleId,
      type: 'action',
      screenKey,
      actionKey: action.charAt(0).toUpperCase() + action.slice(1),
      action,
      granted,
      originalGranted: original,
    });
  }
}

function getEffectiveAction(pendingMap, baseActionMap, roleId, screenKey, action) {
  const key = `${roleId}:${screenKey}:${action}`;
  if (pendingMap.has(key)) return !!pendingMap.get(key).granted;
  return baseActionMap.has(key);
}

// Derive 2D matrix (screens x 5 L2 actions) cho 1 role tu data API (screensByRole).
function buildScreenActionMatrix(role, screensWithPerms, isAdmin) {
  const items = [];
  for (const s of screensWithPerms) {
    const screenKey = s.screenKey;
    // Chỉ màn thuộc đúng module của role — không lấy màn role khác / admin
    if (!isAdmin && !isScreenOwnedByRole(screenKey, s.module, role.roleName)) continue;
    items.push({
      screenKey,
      screenLabel: s.screenLabel || null,
      groupLabel: s.groupLabel || null,
      module: s.module,
      resource: s.resource,
      hasAccess: !!s.hasAccess,
      actions: {
        canView: !!s.canView,
        canCreate: !!s.canCreate,
        canUpdate: !!s.canUpdate,
        canDelete: !!s.canDelete,
        canExport: !!s.canExport,
      },
      availableActions: {
        view: true,
        create: true,
        update: true,
        delete: true,
        export: true,
      },
    });
  }
  return items;
}

function RoleTable({ role, screenPermissions, isAdmin, actionMap, onToggleAction, onToggleAllActions, onToggleAllForRole, pendingForRole, expandedScreens, onToggleExpand }) {
  // Build 2D matrix + overlay pending qua actionMap
  const matrix = useMemo(() => {
    const items = buildScreenActionMatrix(role, screenPermissions, isAdmin);
    return items.map((item) => ({
      ...item,
      actions: {
        canView: actionMap.has(`${role.id}:${item.screenKey}:view`),
        canCreate: actionMap.has(`${role.id}:${item.screenKey}:create`),
        canUpdate: actionMap.has(`${role.id}:${item.screenKey}:update`),
        canDelete: actionMap.has(`${role.id}:${item.screenKey}:delete`),
        canExport: actionMap.has(`${role.id}:${item.screenKey}:export`),
      },
    }));
  }, [role, screenPermissions, isAdmin, actionMap]);

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
                    <span className="role-table__row-label">
                      {getScreenLabel(screenKey, item.screenLabel)}
                    </span>
                    <span className="role-table__row-meta" title={screenKey}>
                      {screenKey}
                    </span>
                  </div>
                  <div className="role-table__row-summary">
                    {anyActionActive ? (
                      <span className="role-table__row-counter">
                        {visibleActions.filter((a) => item.actions[a.key]).length}/{visibleActions.length} quyền
                      </span>
                    ) : (
                      <span className="role-table__row-counter role-table__row-counter--empty">0 quyền</span>
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
                            // Hiệu lực = base API + pending (không chỉ snapshot API)
                            const isGranted = actionMap.has(actionKey);
                            const viewGranted = actionMap.has(`${role.id}:${screenKey}:view`);
                            const needsViewFirst = action.action !== 'view' && !viewGranted;
                            const isPending = pendingForRole && pendingForRole.has(actionKey);
                            const isLoading = actionMap.has(actionKey + '|loading');
                            return (
                              <label
                                key={action.action}
                                className={`role-table__action ${isGranted ? 'role-table__action--granted' : ''} ${isPending ? 'role-table__action--pending' : ''} ${isLoading ? 'role-table__action--loading' : ''} ${needsViewFirst ? 'role-table__action--locked' : ''}`}
                                title={
                                  needsViewFirst
                                    ? 'Cần bật View trước khi cấp quyền này'
                                    : action.action === 'view' && isGranted
                                      ? 'Tắt View sẽ tắt toàn bộ Create/Edit/Disable/Export của màn này'
                                      : undefined
                                }
                              >
                                <span className="role-table__action-icon">{action.icon}</span>
                                <span className="role-table__action-label">{action.label}</span>
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  disabled={isLoading || needsViewFirst}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'requests' ? 'requests' : 'matrix';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => normalizeScreenSearchTerm(searchParams.get('focus') || ''));
  // pendingChanges: Map<key, {roleId, permissionKey, granted, originalGranted, type}>
  //   key = `${roleId}:${permissionKey}`
  //   type = 'permission' (L1 + L2 - permissions table) hoặc 'action' (L2 - role_screen_permissions)
  const [pendingChanges, setPendingChanges] = useState(() => new Map());
  const [saving, setSaving] = useState(false);
  const [expandedScreens, setExpandedScreens] = useState(() => new Set());
  // Ref de tranh stale closure khi SSE callback chay sau khi component unmount.
  const matrixRef = useRef(matrix);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'requests') {
        next.set('tab', 'requests');
      } else {
        next.delete('tab');
        // Click tab Ma trận → hiện đủ danh sách (xóa filter focus cũ)
        next.delete('focus');
        setSearch('');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleFocusRequestInMatrix = useCallback((req) => {
    if (req?.permissionKey) {
      const focus = normalizeScreenSearchTerm(req.permissionKey);
      setSearch(focus);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        next.set('focus', focus);
        if (req.page) next.set('from', req.page);
        return next;
      }, { replace: true });
    }
    setActiveTab('matrix');
  }, [setSearchParams]);

  // Badge số yêu cầu chờ — chỉ poll khi đang ở tab ma trận
  useEffect(() => {
    if (activeTab === 'requests') return undefined;
    let cancelled = false;
    const loadCount = async () => {
      try {
        const data = await permissionRequestApi.listPending();
        if (!cancelled) {
          const items = Array.isArray(data?.items) ? data.items : [];
          setPendingRequestCount(items.length);
        }
      } catch {
        /* badge optional */
      }
    };
    loadCount();
    const t = setInterval(loadCount, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeTab]);

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
   * Toggle 1 action (view/create/update/delete/export).
   * Ràng buộc:
   *  - Bật Create/Edit/Disable/Export khi chưa có View → chặn (UI đã disable).
   *  - Tắt View → tắt luôn toàn bộ quyền còn lại của màn đó.
   */
  const handleToggleAction = useCallback((roleId, screenKey, actionKey, action, granted) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const viewOn = getEffectiveAction(next, baseActionMap, roleId, screenKey, 'view');

      if (action === 'view') {
        upsertActionPending(next, baseActionMap, roleId, screenKey, 'view', granted);
        if (!granted) {
          for (const a of L2_OTHER_ACTIONS) {
            upsertActionPending(next, baseActionMap, roleId, screenKey, a, false);
          }
        }
        return next;
      }

      if (granted && !viewOn) {
        // View chưa bật → không cho cấp quyền khác
        return prev;
      }

      upsertActionPending(next, baseActionMap, roleId, screenKey, action, granted);
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
   * Toggle tat ca 5 actions cua 1 (role, screen).
   * granted=true → bat ca 5 (gom View).
   * granted=false → tat ca 5.
   */
  const handleToggleAllActions = useCallback((roleId, screenKey, granted) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const ACTIONS = ['view', ...L2_OTHER_ACTIONS];
      for (const action of ACTIONS) {
        upsertActionPending(next, baseActionMap, roleId, screenKey, action, granted);
      }
      return next;
    });
  }, [baseActionMap]);

  /**
   * Toggle tat ca actions cua TAT CA screen cua 1 role.
   */
  const handleToggleAllForRole = useCallback((role, screenPermissions, granted) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const ACTIONS = ['view', ...L2_OTHER_ACTIONS];
      for (const screen of screenPermissions) {
        const screenKey = screen.screenKey;
        const available = screen.availableActions || {};
        for (const action of ACTIONS) {
          if (available[action] === false) continue;
          upsertActionPending(next, baseActionMap, role.id, screenKey, action, granted);
        }
      }
      return next;
    });
  }, [baseActionMap]);

  /**
   * Luu toan bo pendingChanges:
   *  - Gop permission changes goi PATCH /api/admin/permission-matrix/bulk.
   *  - Gop action changes goi PUT /api/admin/role-screen-matrix?roleId=X.
   *  - Chuan hoa: canView=false → tat C/U/D/E; co C/U/D/E → bat canView.
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

      // Chuan hoa View-first: co C/U/D/E → bat View; View=false → tat C/U/D/E
      for (const byScreen of actionChangesByRole.values()) {
        for (const item of byScreen.values()) {
          const anyOther = item.canCreate || item.canUpdate || item.canDelete || item.canExport;
          if (anyOther) item.canView = true;
          if (!item.canView) {
            item.canCreate = false;
            item.canUpdate = false;
            item.canDelete = false;
            item.canExport = false;
          }
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

  // Filter screensByRole theo search (ho tro ca key day du screen:...:access)
  const filteredScreenByRole = useMemo(() => {
    if (!matrix?.screensByRole) return {};
    const raw = search.trim();
    if (!raw) return matrix.screensByRole;
    const q = normalizeScreenSearchTerm(raw).toLowerCase() || raw.toLowerCase();
    const next = {};
    for (const roleId of Object.keys(matrix.screensByRole)) {
      next[roleId] = (matrix.screensByRole[roleId] || []).filter((s) => {
        const label = getScreenLabel(s.screenKey, s.screenLabel).toLowerCase();
        const key = (s.screenKey || '').toLowerCase();
        return (
          key.includes(q)
          || label.includes(q)
          || (s.module || '').toLowerCase().includes(q)
          || (s.resource || '').toLowerCase().includes(q)
          || raw.toLowerCase().includes(key)
        );
      });
    }
    return next;
  }, [matrix?.screensByRole, search]);

  const tabsNav = (
    <nav className="matrix-page__tabs" aria-label="Phân quyền">
      <button
        type="button"
        className={`matrix-page__tab ${activeTab === 'matrix' ? 'matrix-page__tab--active' : ''}`}
        onClick={() => switchTab('matrix')}
      >
        Ma trận quyền
      </button>
      <button
        type="button"
        className={`matrix-page__tab ${activeTab === 'requests' ? 'matrix-page__tab--active' : ''}`}
        onClick={() => switchTab('requests')}
      >
        Yêu cầu cấp quyền
        {pendingRequestCount > 0 && (
          <span className="matrix-page__tab-badge">{pendingRequestCount}</span>
        )}
      </button>
    </nav>
  );

  // Tab yêu cầu: luôn hiện được, không phụ thuộc load matrix
  if (activeTab === 'requests') {
    return (
      <div className="matrix-page">
        <header className="matrix-page__header">
          <div className="matrix-page__title-row">
            <span className="matrix-page__icon"><IconShield /></span>
            <div>
              <h1 className="matrix-page__title">Phân quyền hệ thống</h1>
              <p className="matrix-page__subtitle">
                Duyệt yêu cầu từ user hoặc cấp quyền theo vai trò trên ma trận.
              </p>
            </div>
          </div>
        </header>
        {tabsNav}
        <PermissionRequestsPanel
          onFocusInMatrix={handleFocusRequestInMatrix}
          onCountChange={setPendingRequestCount}
        />
      </div>
    );
  }

  if (loading && !matrix) {
    return (
      <div className="matrix-page">
        <header className="matrix-page__header">
          <div className="matrix-page__title-row">
            <span className="matrix-page__icon"><IconShield /></span>
            <div>
              <h1 className="matrix-page__title">Phân quyền hệ thống</h1>
              <p className="matrix-page__subtitle">Đang tải ma trận quyền...</p>
            </div>
          </div>
        </header>
        {tabsNav}
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
        <header className="matrix-page__header">
          <div className="matrix-page__title-row">
            <span className="matrix-page__icon"><IconShield /></span>
            <div>
              <h1 className="matrix-page__title">Phân quyền hệ thống</h1>
              <p className="matrix-page__subtitle">Cấp quyền theo vai trò và duyệt yêu cầu từ user.</p>
            </div>
          </div>
        </header>
        {tabsNav}
        <div className="matrix-empty">
          <IconAlert />
          <h3>Chưa có dữ liệu ma trận quyền</h3>
          <p>
            Vui lòng chạy file SQL{' '}
            <code>BE/scripts/sql/seed_screen_permission_matrix.sql</code> trên SQL Server dùng chung,
            hoặc liên hệ quản trị viên hệ thống.
          </p>
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
            <h1 className="matrix-page__title">Phân quyền hệ thống</h1>
            <p className="matrix-page__subtitle">
              Cấp quyền từng màn hình theo lớp hành động
              <span className="matrix-page__pill">View</span>
              <span className="matrix-page__pill">Create</span>
              <span className="matrix-page__pill">Edit</span>
              <span className="matrix-page__pill">Disable</span>
              <span className="matrix-page__pill">Export</span>
              — View bắt buộc trước; tắt View sẽ tắt hết quyền còn lại.
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

      {tabsNav}

      {pendingStats.total === 0 && matrix && (
        <div className="matrix-page__bulk-hint">
          <strong>Mẹo:</strong> Bật <strong>View</strong> trước, rồi mới Create/Edit/Disable/Export.
          Tick nhiều ô liên tục — thanh <strong>Lưu</strong> cố định ở dưới màn hình, không cần cuộn lên.
        </div>
      )}

      <div className="matrix-page__admin-banner" role="note">
        <div className="matrix-page__admin-banner-icon"><IconShield /></div>
        <div>
          <strong>Admin — Full Access</strong>
          <p>
            Vai trò quản trị hệ thống dùng quyền wildcard <code>*</code>, không phân theo ô View/Create/Edit.
            Không hiện trong ma trận bên dưới để tránh chỉnh nhầm (dễ dư thừa vì Admin đã quản lý toàn hệ thống).
          </p>
        </div>
      </div>

      <div className={`matrix-page__grid ${pendingStats.total > 0 ? 'matrix-page__grid--has-dock' : ''}`}>
        {matrix.roles.map((role) => {
          if (role.roleName === 'admin') return null;
          const screenPermissions = filteredScreenByRole[role.id] || [];
          return (
            <RoleTable
              key={role.id}
              role={role}
              screenPermissions={screenPermissions}
              isAdmin={false}
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
          <span className="matrix-page__legend-item">
            View tắt → Create/Edit/Disable/Export bị khóa
          </span>
        </div>
        <small>
          Tổng: <strong>{matrix.roles.filter((r) => r.roleName !== 'admin').length}</strong> vai trò nghiệp vụ
          (Admin Full Access riêng).
          Cập nhật lúc: {new Date(matrix.generatedAt).toLocaleString('vi-VN')}
        </small>
      </footer>

      {/* Dock Lưu cố định dưới cùng — luôn trong tầm nhìn, không cần cuộn lên */}
      {pendingStats.total > 0 && (
        <div className="matrix-page__save-dock" role="region" aria-label="Thay đổi chưa lưu">
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
    </div>
  );
}
