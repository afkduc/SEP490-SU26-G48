import { useEffect, useMemo, useState, useCallback } from 'react';
import { adminRolesApi, roleScreenMatrixApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import './RoleScreenMatrixPage.css';

// ─── Icons ────────────────────────────────────────────────────────────

const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
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

// ─── Action cell (V/C/U/D/E) ───────────────────────────────────────

function ActionCell({ granted, disabled, onToggle, label }) {
  return (
    <button
      type="button"
      className={`sm-cell ${granted ? 'sm-cell--on' : 'sm-cell--off'} ${disabled ? 'sm-cell--disabled' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      title={
        disabled
          ? 'Cần bật View trước khi cấp quyền này'
          : label === 'V' && granted
            ? 'Tắt View sẽ tắt toàn bộ Create/Edit/Disable/Export'
            : granted
              ? `Đã bật ${label}`
              : `Chưa bật ${label}`
      }
    >
      {granted ? <IconCheck /> : <IconX />}
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

/**
 * Multi-role screen matrix.
 *
 * Hien thi bang (screen x role), moi cell co 5 nut (V/C/U/D/E).
 * Admin co the toggle bat ky cell nao de cap quyen cho role do tren screen do.
 *
 * Data source: GET /api/admin/role-screen-matrix?roleId=X cho TUNG role,
 * merge lai thanh 1 mega-matrix.
 */
export default function RoleScreenMatrixPage() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [screens, setScreens] = useState([]);
  // matrix[roleId][screenKey] = { canView, canCreate, canUpdate, canDelete, canExport }
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // View mode: 'cross' = Screen × Role (multi-col), 'perRole' = Mỗi vai trò 1 bảng riêng
  const [viewMode, setViewMode] = useState('perRole');
  // Lọc role nào sẽ hiển thị (chỉ áp dụng ở mode 'perRole')
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rolesResp = await adminRolesApi.list();
      const roleList = (rolesResp?.items || rolesResp || []).filter(
        (r) => r.roleName !== 'admin' && r.role_name !== 'admin'
      );
      setRoles(roleList);
      // Default: chọn tất cả roles business (không gồm admin)
      setSelectedRoleIds((prev) => prev.length > 0 ? prev : roleList.map((r) => r.id));

      // Lay matrix cho tung role song song
      const matrixData = await Promise.all(
        roleList.map(async (role) => {
          try {
            const data = await roleScreenMatrixApi.getMatrix(role.id);
            return { roleId: role.id, screens: data?.data?.screens || [] };
          } catch (e) {
            console.warn(`Failed to load matrix for role ${role.id}:`, e.message);
            return { roleId: role.id, screens: [] };
          }
        })
      );

      // Union all screens
      const screensMap = new Map();
      for (const { screens: rs } of matrixData) {
        for (const s of rs) {
          if (!screensMap.has(s.screenKey)) {
            const parts = s.screenKey.split(':');
            screensMap.set(s.screenKey, {
              screenKey: s.screenKey,
              module: parts[0] || '',
              resource: parts[1] || '',
            });
          }
        }
      }
      const sortedScreens = Array.from(screensMap.values()).sort((a, b) =>
        a.screenKey.localeCompare(b.screenKey)
      );
      setScreens(sortedScreens);

      // Build matrix map
      const map = {};
      for (const { roleId, screens: rs } of matrixData) {
        map[roleId] = {};
        for (const s of rs) {
          map[roleId][s.screenKey] = {
            canView: Boolean(s.canView),
            canCreate: Boolean(s.canCreate),
            canUpdate: Boolean(s.canUpdate),
            canDelete: Boolean(s.canDelete),
            canExport: Boolean(s.canExport),
          };
        }
      }
      setMatrix(map);
    } catch (err) {
      setError(err.message || 'Khong tai duoc matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Toggle cell — View-first: View bat truoc; tat View → tat het
  async function handleToggle(roleId, screenKey, actionKey) {
    const current = matrix[roleId]?.[screenKey] || {
      canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false,
    };
    const nextVal = !current[actionKey];
    let updated = { ...current, [actionKey]: nextVal };

    if (actionKey === 'canView' && !nextVal) {
      updated = {
        ...updated,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canExport: false,
      };
    } else if (actionKey !== 'canView' && nextVal && !current.canView) {
      toast.info('Cần bật View trước khi cấp quyền này');
      return;
    }

    // Optimistic update
    setMatrix((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [screenKey]: updated },
    }));

    try {
      await roleScreenMatrixApi.saveMatrix(roleId, [{
        screenKey,
        canView: updated.canView,
        canCreate: updated.canCreate,
        canUpdate: updated.canUpdate,
        canDelete: updated.canDelete,
        canExport: updated.canExport,
      }]);
    } catch (err) {
      // Rollback
      setMatrix((prev) => ({
        ...prev,
        [roleId]: { ...prev[roleId], [screenKey]: current },
      }));
      toast.error(err.message || 'Lỗi khi lưu');
    }
  }

  // Filter screens
  const filteredScreens = useMemo(() => {
    if (!search.trim()) return screens;
    const q = search.toLowerCase();
    return screens.filter((s) =>
      s.screenKey.toLowerCase().includes(q) ||
      (s.module || '').toLowerCase().includes(q) ||
      (s.resource || '').toLowerCase().includes(q)
    );
  }, [screens, search]);

  // Lấy danh sách screens cho 1 role - HIỂN THỊ TẤT CẢ screens auto-discovered,
  // kể cả khi role chưa có row trong role_screen_permissions (chưa tick).
  // Mac dinh canView/Create/Update/Delete/Export = false cho screen chua co row.
  // Logic nay dam bao admin co the BAT quyen cho bat ky screen nao, khong bi gioi
  // han boi data cu.
  const getGrantedScreensForRole = useCallback((roleId) => {
    const result = [];
    const emptyMatrix = {
      canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false,
    };
    for (const s of filteredScreens) {
      const m = matrix[roleId]?.[s.screenKey] ?? emptyMatrix;
      const hasAny = m.canView || m.canCreate || m.canUpdate || m.canDelete || m.canExport;
      result.push({ screen: s, matrix: m, hasAny });
    }
    // Sap xep: co quyen truoc, sau do theo screenKey
    return result.sort((a, b) => {
      if (a.hasAny !== b.hasAny) return a.hasAny ? -1 : 1;
      return a.screen.screenKey.localeCompare(b.screen.screenKey);
    });
  }, [matrix, filteredScreens]);

  // Thống kê cho 1 role
  const getRoleStats = useCallback((roleId) => {
    const list = getGrantedScreensForRole(roleId);
    const granted = list.filter((x) => x.hasAny).length;
    const total = list.length;
    return { granted, total, list };
  }, [getGrantedScreensForRole]);

  // Toggle role selection trong perRole mode
  const toggleRoleSelection = (roleId) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const visibleRoles = useMemo(() => {
    if (viewMode !== 'perRole') return roles;
    return roles.filter((r) => selectedRoleIds.includes(r.id));
  }, [roles, selectedRoleIds, viewMode]);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <div className="admin-page__title-icon" style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)' }}>
            <IconShield />
          </div>
          <div className="admin-page__title-group">
            <h1>Phân quyền theo màn × Hành động</h1>
            <p className="admin-page__subtitle">
              Chỉ các vai trò nghiệp vụ (không gồm Admin — Admin dùng quyền <code>*</code>).
              {viewMode === 'perRole'
                ? ' Chế độ theo vai trò: mỗi role một bảng. View bắt buộc trước các quyền khác. Thay đổi tự lưu.'
                : ' Chế độ ma trận tổng: màn × role × View/Create/Update/Disable/Export. View bắt buộc trước.'}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sm-toolbar">
        <div className="sm-toolbar__stats">
          {viewMode === 'cross' ? (
            <span><strong>{roles.length}</strong> roles × <strong>{filteredScreens.length}</strong> screens × <strong>5</strong> actions</span>
          ) : (
            <span>
              Hiển thị <strong>{visibleRoles.length}/{roles.length}</strong> vai trò.
              Mỗi vai trò chỉ liệt kê các màn hình thuộc phạm vi quyền của vai trò đó.
            </span>
          )}
        </div>
        <div className="sm-toolbar__actions">
          <div className="sm-mode-switch" role="tablist" aria-label="Chế độ hiển thị">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'perRole'}
              className={`sm-mode-switch__btn ${viewMode === 'perRole' ? 'sm-mode-switch__btn--active' : ''}`}
              onClick={() => setViewMode('perRole')}
              title="Mỗi vai trò 1 bảng riêng - chỉ hiện các màn của vai trò đó"
            >
              Theo vai trò
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'cross'}
              className={`sm-mode-switch__btn ${viewMode === 'cross' ? 'sm-mode-switch__btn--active' : ''}`}
              onClick={() => setViewMode('cross')}
              title="Ma trận tổng: 1 màn × tất cả vai trò"
            >
              Ma trận tổng
            </button>
          </div>
          <input
            type="text"
            className="sm-search"
            placeholder="Tìm screen (vd: manager, dashboard)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn btn--ghost btn--sm"
            onClick={loadMatrix}
            disabled={loading}
          >
            <IconRefresh /> Tải lại
          </button>
        </div>
      </div>

      {viewMode === 'perRole' && (
        <div className="sm-role-filter">
          <span className="sm-role-filter__label">Vai trò:</span>
          <div className="sm-role-filter__list">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`sm-role-filter__chip ${selectedRoleIds.includes(r.id) ? 'sm-role-filter__chip--active' : ''}`}
                onClick={() => toggleRoleSelection(r.id)}
              >
                {selectedRoleIds.includes(r.id) ? <IconCheck /> : <IconX />}
                <span>{r.roleLabel || r.roleName}</span>
              </button>
            ))}
            {selectedRoleIds.length !== roles.length && (
              <button
                type="button"
                className="sm-role-filter__chip sm-role-filter__chip--all"
                onClick={() => setSelectedRoleIds(roles.map((r) => r.id))}
              >
                Chọn tất cả
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="sm-loading">Đang tải matrix...</div>
      ) : error ? (
        <div className="sm-error">
          <IconAlert /> <span>{error}</span>
        </div>
      ) : viewMode === 'cross' ? (
        <div className="sm-multi-table-wrapper">
          <table className="sm-multi-table">
            <thead>
              <tr>
                <th className="sm-multi-table__screen-col">Screen (module:resource)</th>
                {roles.map((r) => (
                  <th key={r.id} className="sm-multi-table__role-col" title={r.roleLabel || r.roleName}>
                    {r.roleLabel || r.roleName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredScreens.map((s) => (
                <tr key={s.screenKey}>
                  <td className="sm-multi-table__screen-cell">
                    <code>{s.screenKey}</code>
                    <span className="sm-multi-table__module">{s.module}</span>
                  </td>
                  {roles.map((r) => {
                    const m = matrix[r.id]?.[s.screenKey] || {
                      canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false,
                    };
                    return (
                      <td key={r.id} className="sm-multi-table__action-cell">
                        <div className="sm-multi-table__action-row">
                          <ActionCell granted={m.canView} onToggle={() => handleToggle(r.id, s.screenKey, 'canView')} label="V" />
                          <ActionCell granted={m.canCreate} disabled={!m.canView} onToggle={() => handleToggle(r.id, s.screenKey, 'canCreate')} label="C" />
                          <ActionCell granted={m.canUpdate} disabled={!m.canView} onToggle={() => handleToggle(r.id, s.screenKey, 'canUpdate')} label="U" />
                          <ActionCell granted={m.canDelete} disabled={!m.canView} onToggle={() => handleToggle(r.id, s.screenKey, 'canDelete')} label="D" />
                          <ActionCell granted={m.canExport} disabled={!m.canView} onToggle={() => handleToggle(r.id, s.screenKey, 'canExport')} label="E" />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredScreens.length === 0 && (
                <tr><td colSpan={roles.length + 1} className="sm-empty">Không có screen nào khớp với tìm kiếm.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sm-per-role-list">
          {visibleRoles.length === 0 ? (
            <div className="sm-empty">Chưa chọn vai trò nào. Bấm chip bên trên để chọn.</div>
          ) : (
            visibleRoles.map((role) => {
              const stats = getRoleStats(role.id);
              return (
                <section key={role.id} className="sm-role-block">
                  <header className="sm-role-block__header">
                    <div className="sm-role-block__title">
                      <h2>{role.roleLabel || role.roleName}</h2>
                      <code>{role.roleName}</code>
                    </div>
                    <div className="sm-role-block__stats">
                      <span className="sm-role-block__stat sm-role-block__stat--ok">
                        {stats.granted}/{stats.total} màn đã bật quyền
                      </span>
                      <span className="sm-role-block__stat">
                        {stats.total - stats.granted} màn chưa bật
                      </span>
                    </div>
                  </header>
                  {stats.list.length === 0 ? (
                    <div className="sm-empty">Không có screen nào trong phạm vi tìm kiếm.</div>
                  ) : (
                    <table className="sm-multi-table">
                      <thead>
                        <tr>
                          <th className="sm-multi-table__screen-col">Screen (module:resource)</th>
                          <th className="sm-multi-table__action-col">View</th>
                          <th className="sm-multi-table__action-col">Create</th>
                          <th className="sm-multi-table__action-col">Update</th>
                          <th className="sm-multi-table__action-col">Disable</th>
                          <th className="sm-multi-table__action-col">Export</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.list.map(({ screen: s, matrix: m, hasAny }) => (
                          <tr key={s.screenKey} className={hasAny ? '' : 'sm-row--muted'}>
                            <td className="sm-multi-table__screen-cell">
                              <code>{s.screenKey}</code>
                              <span className="sm-multi-table__module">{s.module}</span>
                            </td>
                            <td className="sm-multi-table__action-cell">
                              <ActionCell granted={m.canView} onToggle={() => handleToggle(role.id, s.screenKey, 'canView')} label="V" />
                            </td>
                            <td className="sm-multi-table__action-cell">
                              <ActionCell granted={m.canCreate} disabled={!m.canView} onToggle={() => handleToggle(role.id, s.screenKey, 'canCreate')} label="C" />
                            </td>
                            <td className="sm-multi-table__action-cell">
                              <ActionCell granted={m.canUpdate} disabled={!m.canView} onToggle={() => handleToggle(role.id, s.screenKey, 'canUpdate')} label="U" />
                            </td>
                            <td className="sm-multi-table__action-cell">
                              <ActionCell granted={m.canDelete} disabled={!m.canView} onToggle={() => handleToggle(role.id, s.screenKey, 'canDelete')} label="D" />
                            </td>
                            <td className="sm-multi-table__action-cell">
                              <ActionCell granted={m.canExport} disabled={!m.canView} onToggle={() => handleToggle(role.id, s.screenKey, 'canExport')} label="E" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              );
            })
          )}
        </div>
      )}

      <footer className="sm-footer">
        <div className="sm-legend">
          <span className="sm-legend-item">
            <span className="sm-cell sm-cell--on"><IconCheck /></span> = Đã bật
          </span>
          <span className="sm-legend-item">
            <span className="sm-cell sm-cell--off"><IconX /></span> = Chưa bật
          </span>
        </div>
      </footer>
    </div>
  );
}
