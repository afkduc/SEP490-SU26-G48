import { useState, useCallback } from 'react';
import { useAdminRoles, useRoleDetail } from '../../hooks/admin/useAdminRoles';
import './AdminRolesPage.css';

const ROLE_ACCENT_COLORS = [
  '#4f46e5', '#7c3aed', '#059669', '#d97706',
  '#0891b2', '#db2777', '#dc2626', '#65a30d',
];

function RoleCardIcon({ index }) {
  const icons = [
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>,
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>,
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>,
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
    </svg>,
  ];
  return icons[index % icons.length];
}

function RoleDetailModal({ roleId, onClose }) {
  const { role, loading, error } = useRoleDetail(roleId);

  if (!roleId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Chi tiết vai trò</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {loading && <div className="modal-loading">Đang tải...</div>}
        {error && <div className="modal-error">{error}</div>}
        {role && (
          <div className="modal-body">
            <div className="detail-grid">
              <div className="detail-row">
                <span className="detail-label">Tên vai trò</span>
                <span className="detail-value">{role.roleName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Nhãn</span>
                <span className="detail-value">{role.roleLabel || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Mô tả</span>
                <span className="detail-value">{role.description || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Trạng thái</span>
                <span className={`status-badge status-badge--${role.isActive ? 'active' : 'inactive'}`}>
                  {role.isActive ? 'Hoạt động' : 'Không hoạt động'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Số người dùng</span>
                <span className="detail-value" style={{ fontWeight: 700, color: '#4f46e5' }}>
                  {role.userCount ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminRolesPage() {
  const { roles, total, loading, error, refetch } = useAdminRoles();
  const [detailRoleId, setDetailRoleId] = useState(null);

  return (
    <div className="admin-roles">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="admin-roles__header">
        <div className="admin-roles__title-block">
          <div className="admin-roles__title-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h1 className="admin-roles__title">Quản lý vai trò</h1>
            <p className="admin-roles__subtitle">Xem danh sách & phân quyền người dùng</p>
          </div>
        </div>
        <div className="admin-roles__actions">
          <span className="admin-roles__total-badge">{total} vai trò</span>
          <button className="btn btn--outline" onClick={refetch}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Tải lại
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert--error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="roles-loading">
          <div className="roles-spinner" />
          <span>Đang tải danh sách vai trò...</span>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {roles.length === 0 ? (
            <div className="roles-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <p>Chưa có vai trò nào</p>
            </div>
          ) : (
            <div className="roles-grid">
              {roles.map((role, index) => (
                <div
                  key={role.id}
                  className="role-card"
                  style={{ '--card-accent': ROLE_ACCENT_COLORS[index % ROLE_ACCENT_COLORS.length] }}
                >
                  <div className="role-card__header">
                    <div className="role-card__icon">
                      <RoleCardIcon index={index} />
                    </div>
                    <div className={`role-card__badge ${role.isActive ? 'active' : 'inactive'}`}>
                      {role.isActive ? 'Hoạt động' : 'Ngừng'}
                    </div>
                  </div>

                  <div className="role-card__body">
                    <h3 className="role-card__name">{role.roleName}</h3>
                    <p className="role-card__label">{role.roleLabel || '—'}</p>
                    {role.description && (
                      <p className="role-card__desc">{role.description}</p>
                    )}
                  </div>

                  <div className="role-card__footer">
                    <div className="role-card__stat">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                      </svg>
                      <span>{role.userCount ?? 0} người dùng</span>
                    </div>
                    <div className="role-card__actions">
                      <button
                        className="role-card__btn role-card__btn--detail"
                        onClick={() => setDetailRoleId(role.id)}
                        title="Xem chi tiết"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          <line x1="11" y1="8" x2="11" y2="14"/>
                          <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                      </button>
                      <button
                        className="role-card__btn role-card__btn--assign"
                        onClick={() => navigate('/admin/users')}
                        title="Phân quyền"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          <line x1="12" y1="8" x2="12" y2="16"/>
                          <line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Role Detail Modal ──────────────────────────────────── */}
      {detailRoleId && (
        <RoleDetailModal roleId={detailRoleId} onClose={() => setDetailRoleId(null)} />
      )}
    </div>
  );
}
