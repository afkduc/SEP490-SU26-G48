import { useState, useEffect, useCallback } from 'react';
import { adminRolesApi, adminUserRolesApi } from '../../../services/adminApi';
import './AssignRoleModal.css';

export default function AssignRoleModal({ userId, onClose, onSuccess }) {
  const [allRoles, setAllRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rolesRes, userRolesRes] = await Promise.all([
          adminRolesApi.list(),
          adminUserRolesApi.getUserRoles(userId),
        ]);
        if (cancelled) return;
        const roles = rolesRes?.items ?? rolesRes ?? [];
        const current = Array.isArray(userRolesRes)
          ? userRolesRes
          : (userRolesRes?.items ?? []);
        setAllRoles(roles);
        setUserRoles(current);
        setSelected(new Set(current.map((r) => r.roleId)));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Khong the tai danh sach role');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const toggleRole = useCallback((roleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const currentIds = new Set(userRoles.map((r) => r.roleId));
      const selectedIds = [...selected];

      // role can be assigned but not yet selected -> assign
      const toAssign = selectedIds.filter((id) => !currentIds.has(id));
      // role is assigned but not selected -> revoke
      const toRevoke = [...currentIds].filter((id) => !selected.has(id));

      for (const roleId of toAssign) {
        await adminUserRolesApi.assignRoles({ userId, roleIds: [roleId] });
      }
      for (const roleId of toRevoke) {
        await adminUserRolesApi.revokeRole(userId, roleId);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Luu that bai');
    } finally {
      setSaving(false);
    }
  }, [userId, selected, userRoles, onSuccess, onClose]);

  const changed =
    selected.size !== userRoles.length ||
    ![...selected].every((id) => userRoles.some((r) => r.roleId === id));

  return (
    <div className="assign-role-overlay" onClick={onClose}>
      <div className="assign-role-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="assign-role-header">
          <div className="assign-role-header__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div>
            <h2 className="assign-role-header__title">Phan quyen nguoi dung</h2>
            <p className="assign-role-header__sub">Chon vai tro de gan cho nguoi dung nay</p>
          </div>
          <button className="assign-role-close" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="assign-role-body">
          {loading && (
            <div className="assign-role-loading">
              <div className="spinner" />
              <span>Dang tai...</span>
            </div>
          )}

          {error && !loading && (
            <div className="assign-role-error">{error}</div>
          )}

          {!loading && !error && allRoles.length === 0 && (
            <div className="assign-role-empty">Chua co vai tro nao</div>
          )}

          {!loading && !error && allRoles.length > 0 && (
            <div className="assign-role-list">
              {allRoles.map((role) => {
                const isChecked = selected.has(role.id);
                return (
                  <label
                    key={role.id}
                    className={`assign-role-item ${isChecked ? 'checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRole(role.id)}
                      className="assign-role-checkbox"
                    />
                    <div className="assign-role-item__body">
                      <div className="assign-role-item__name">
                        <span className="assign-role-item__role-name">{role.roleName}</span>
                        {role.roleLabel && (
                          <span className="assign-role-item__role-label">{role.roleLabel}</span>
                        )}
                      </div>
                      {role.description && (
                        <p className="assign-role-item__desc">{role.description}</p>
                      )}
                    </div>
                    <div className={`assign-role-item__check ${isChecked ? 'active' : ''}`}>
                      {isChecked ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="assign-role-footer">
          <span className="assign-role-selected-count">
            {selected.size} vai tro duoc chon
          </span>
          <div className="assign-role-footer__actions">
            <button className="btn-cancel" onClick={onClose} disabled={saving}>
              Huy
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={saving || !changed}
            >
              {saving ? (
                <>
                  <div className="spinner spinner--sm" />
                  Dang luu...
                </>
              ) : 'Luu thay doi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
