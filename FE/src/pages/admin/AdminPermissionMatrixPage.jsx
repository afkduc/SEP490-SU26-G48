import { useEffect, useMemo, useState, useCallback } from 'react';
import { permissionMatrixApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import './AdminPermissionMatrixPage.css';

// ─── Mapping: role nao "so huu" module nao ──────────────────────────
// Moi role chi thay cac screens lien quan den cong viec cua role do
// + cac shared modules (customer, dashboard, ...) ma moi role can thay.
//
// Ly do: neu hien 49 screens cho moi role, manager phai scroll qua cac
// screen cua technician, warehouse_staff... rat rac roi va de cap nham.
//
// Admin thay TAT CA (bao gom wildcard '*').
// Role moi (custom) mac dinh chi thay shared modules - admin co the
// customize bang cach sua bang nay.
const ROLE_SCREEN_MATRIX = {
  admin: ['*'],
  manager: ['manager', 'customer', 'customer_care', 'dashboard', 'repair_order', 'repair_settlement', 'system'],
  warehouse_staff: ['inventory', 'customer', 'customer_care', 'dashboard', 'repair_order', 'repair_settlement', 'system'],
  service_advisor: ['service_advisor', 'customer', 'customer_care', 'dashboard', 'repair_order', 'repair_settlement', 'system'],
  team_leader: ['team_leader', 'customer', 'customer_care', 'dashboard', 'repair_order', 'repair_settlement', 'system'],
  technician: ['technician', 'customer', 'customer_care', 'dashboard', 'repair_order', 'repair_settlement', 'system'],
  general_director: ['general_director', 'customer', 'customer_care', 'dashboard', 'repair_order', 'repair_settlement', 'system'],
};

/**
 * Loc danh sach screens cho mot role cu the.
 * Role admin -> thay tat ca (bao gom wildcard).
 * Role khac -> chi thay screens thuoc cac modules trong ROLE_SCREEN_MATRIX.
 */
function filterScreensForRole(screens, roleName) {
  if (!screens || screens.length === 0) return [];
  const allowedModules = ROLE_SCREEN_MATRIX[roleName];
  if (!allowedModules) {
    // Role khong co trong mapping -> chi thay wildcard + shared (an toan)
    return screens.filter((s) => s.permissionKey === '*' ||
      ['customer', 'customer_care', 'dashboard', 'repair_order', 'repair_settlement', 'system'].includes(s.module)
    );
  }
  if (allowedModules.includes('*')) return screens;
  return screens.filter((s) =>
    s.permissionKey === '*' || allowedModules.includes(s.module)
  );
}

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
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
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

function RoleTable({ role, screens, grantSet, toggling, onToggle, isAdmin }) {
  const stats = useMemo(() => {
    const total = screens.length;
    const granted = screens.filter((s) => grantSet.has(`${role.id}_${s.id}`)).length;
    return { total, granted };
  }, [screens, grantSet, role.id]);

  return (
    <section className={`role-table ${isAdmin ? 'role-table--admin' : ''}`}>
      <header className="role-table__header">
        <div className="role-table__title-row">
          <h3 className="role-table__title">{role.roleLabel || role.roleName}</h3>
          {isAdmin && <span className="role-table__badge">FULL ACCESS</span>}
        </div>
        <div className="role-table__meta">
          <span className="role-table__role-name">{role.roleName}</span>
          <span className="role-table__counter">
            {stats.granted}/{stats.total} màn hình được truy cập
          </span>
          {!isAdmin && (
            <span className="role-table__filter-hint">
              (đã lọc theo vai trò)
            </span>
          )}
        </div>
      </header>

      <div className="role-table__body">
        {screens.length === 0 ? (
          <div className="role-table__empty">Chưa có màn hình nào trong hệ thống.</div>
        ) : (
          <ul className="role-table__list">
            {screens.map((screen) => {
              const isGranted = grantSet.has(`${role.id}_${screen.id}`);
              const key = `${role.id}_${screen.id}`;
              const isLoading = toggling.has(key);
              return (
                <li key={screen.id} className={`role-table__item ${isGranted ? 'role-table__item--granted' : ''}`}>
                  <div className="role-table__item-info">
                    <span className="role-table__item-label">{screen.description || screen.resource}</span>
                    <span className="role-table__item-key">{screen.permissionKey}</span>
                  </div>
                  {isAdmin && screen.permissionKey === '*' ? (
                    <span className="perm-cell perm-cell--locked" title="Wildcard cho admin - không thể thu hồi">
                      <IconCheck />
                    </span>
                  ) : (
                    <PermissionCell
                      granted={isGranted}
                      loading={isLoading}
                      disabled={isAdmin && screen.permissionKey === '*'}
                      onToggle={() => onToggle(role.id, screen.id, !isGranted)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function AdminPermissionMatrixPage() {
  const { showToast } = useToast();
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(() => new Set());
  const [search, setSearch] = useState('');

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permissionMatrixApi.getMatrix();
      setMatrix(data);
    } catch (err) {
      showToast({ message: err.message || 'Lỗi tải ma trận quyền', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const grantSet = useMemo(() => {
    if (!matrix) return new Set();
    return new Set(matrix.grants.map((g) => `${g.roleId}_${g.permissionId}`));
  }, [matrix]);

  const handleToggle = useCallback(async (roleId, permissionId, granted) => {
    const key = `${roleId}_${permissionId}`;
    setToggling((prev) => new Set(prev).add(key));
    try {
      await permissionMatrixApi.toggleCell({ roleId, permissionId, granted });
      setMatrix((prev) => {
        if (!prev) return prev;
        const newGrants = prev.grants.filter((g) => !(g.roleId === roleId && g.permissionId === permissionId));
        if (granted) newGrants.push({ roleId, permissionId });
        return { ...prev, grants: newGrants };
      });
      showToast({ message: granted ? 'Đã cấp quyền truy cập màn hình' : 'Đã thu hồi quyền truy cập màn hình', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'Lỗi cập nhật quyền', type: 'error' });
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [showToast]);

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
              Admin thấy tất cả. Sau khi thay đổi, người dùng cần <strong>đăng xuất và đăng nhập lại</strong> để nhận quyền mới.
            </p>
          </div>
        </div>

        <div className="matrix-page__actions">
          <input
            type="search"
            className="matrix-page__search"
            placeholder="Tìm theo tên màn hình hoặc nhóm chức năng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="matrix-page__refresh" onClick={loadMatrix} disabled={loading}>
            <IconRefresh /> Tải lại
          </button>
        </div>
      </header>

      <div className="matrix-page__grid">
        {matrix.roles.map((role) => {
          // Loc screens theo role truoc, roi moi apply search filter tren ket qua.
          const roleScreens = filterScreensForRole(matrix.screens, role.roleName);
          const visibleScreens = search.trim() === ''
            ? roleScreens
            : roleScreens.filter((s) =>
                (s.description || '').toLowerCase().includes(search.trim().toLowerCase()) ||
                (s.permissionKey || '').toLowerCase().includes(search.trim().toLowerCase()) ||
                (s.module || '').toLowerCase().includes(search.trim().toLowerCase()) ||
                (s.resource || '').toLowerCase().includes(search.trim().toLowerCase())
              );
          return (
            <RoleTable
              key={role.id}
              role={role}
              screens={visibleScreens}
              grantSet={grantSet}
              toggling={toggling}
              onToggle={handleToggle}
              isAdmin={role.roleName === 'admin'}
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
            <span className="perm-cell perm-cell--locked"><IconCheck /></span> = Không thể thu hồi (admin wildcard)
          </span>
        </div>
        <small>
          Tổng: <strong>{matrix.roles.length}</strong> roles × <strong>{matrix.screens.length}</strong> screens (hệ thống).
          Cập nhật lúc: {new Date(matrix.generatedAt).toLocaleString('vi-VN')}
        </small>
      </footer>
    </div>
  );
}