import { useEffect, useState } from 'react';
import { adminUsersApi, adminSpecialtiesApi } from '../../../services/adminApi';
import { useToast } from '../../../components/common/ToastContext';
import '../components/AdminDrawer.css';

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Không hoạt động',
  locked: 'Bị khóa',
};

const STATUS_CLASS = {
  active: 'badge--success',
  inactive: 'badge--danger',
  locked: 'badge--danger',
};

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

function DetailRow({ label, value, badge }) {
  return (
    <div className="detail-list__item">
      <dt>{label}</dt>
      <dd>
        {badge ? (
          <span className={`badge ${badge}`}>{value}</span>
        ) : (
          value || <span style={{ color: '#cbd5e1' }}>—</span>
        )}
      </dd>
    </div>
  );
}

export default function UserDetailDrawer({ userId, onClose, onRolesChanged }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allSpecialties, setAllSpecialties] = useState([]);
  const [userSpecialtyIds, setUserSpecialtyIds] = useState([]);
  const [savingSpecs, setSavingSpecs] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const [res, specs, userSpecs] = await Promise.all([
          adminUsersApi.getDetail(userId),
          adminSpecialtiesApi.list().catch(() => ({ items: [] })),
          adminSpecialtiesApi.getUserSpecialties(userId).catch(() => ({ items: [] })),
        ]);
        if (!cancelled) {
          setUser(res);
          setAllSpecialties((specs?.items || []).filter((s) => s.isActive !== false));
          setUserSpecialtyIds((userSpecs?.items || []).map((s) => s.id || s.specialtyId).filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được chi tiết người dùng');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || '—'
    : '—';

  function toggleSpecialty(id) {
    setUserSpecialtyIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  }

  async function handleSaveSpecialties() {
    setSavingSpecs(true);
    try {
      await adminSpecialtiesApi.setUserSpecialties(userId, userSpecialtyIds);
      toast.success('Đã cập nhật chuyên môn');
      onRolesChanged?.();
    } catch (err) {
      toast.error(err?.message || 'Không lưu được chuyên môn');
    } finally {
      setSavingSpecs(false);
    }
  }

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer">
        <div className="drawer__header">
          <div className="drawer__title-block">
            <div className="drawer__title-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2 className="drawer__title">Chi tiết người dùng</h2>
          </div>
          <button className="drawer__close" onClick={onClose} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="drawer__body">
          {loading ? (
            <div className="drawer__loading">Đang tải chi tiết người dùng</div>
          ) : error ? (
            <div className="drawer__error">{error}</div>
          ) : user ? (
            <>
              <div className="user-info-card">
                <div className="user-info-card__avatar">
                  {getInitials(user.firstName, user.lastName)}
                </div>
                <h3 className="user-info-card__name">{fullName}</h3>
                <p className="user-info-card__username">
                  @{user.name}
                  {user.phone ? ` · ${user.phone}` : ''}
                </p>
                {user.roles?.length > 0 && (
                  <div className="user-info-card__roles">
                    {user.roles.map((r) => {
                      const name = typeof r === 'object' && r !== null ? r.roleName : r;
                      const key = typeof r === 'object' && r !== null ? r.roleId : r;
                      return (
                        <span key={key} className="badge badge--info">{name}</span>
                      );
                    })}
                  </div>
                )}
              </div>

              <dl className="detail-list">
                <div className="detail-list__group">
                  <div className="detail-list__group-title">Thông tin tài khoản</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow label="ID" value={<span className="font-mono">#{user.id}</span>} />
                  <DetailRow label="Email" value={user.email} />
                  <DetailRow
                    label="Trạng thái"
                    value={STATUS_LABELS[user.status] || user.status}
                    badge={STATUS_CLASS[user.status] || ''}
                  />
                </div>

                <div className="detail-list__group">
                  <div className="detail-list__group-title">Thông tin cá nhân</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow label="Họ" value={user.firstName || '—'} />
                  <DetailRow label="Tên" value={user.lastName || '—'} />
                  <DetailRow label="Số điện thoại" value={user.phone || '—'} />
                </div>

                <div className="detail-list__group">
                  <div className="detail-list__group-title">Phân công</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow
                    label="Chi nhánh"
                    value={
                      user.scopeAllBranches
                        ? 'Tất cả chi nhánh'
                        : (user.branchName || '—')
                    }
                  />
                </div>

                <div className="detail-list__group">
                  <div className="detail-list__group-title">Chuyên môn</div>
                </div>
                <div className="detail-list__group" style={{ padding: '8px 0 12px' }}>
                  {allSpecialties.length === 0 ? (
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>Chưa có chuyên môn trong hệ thống</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {allSpecialties.map((s) => {
                        const id = s.id;
                        const checked = userSpecialtyIds.includes(id);
                        return (
                          <label
                            key={id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 999,
                              border: `1px solid ${checked ? '#4f46e5' : '#e2e8f0'}`,
                              background: checked ? '#eef2ff' : '#fff',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSpecialty(id)}
                            />
                            {s.specialtyName || s.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {allSpecialties.length > 0 && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      style={{ marginTop: 10 }}
                      disabled={savingSpecs}
                      onClick={handleSaveSpecialties}
                    >
                      {savingSpecs ? 'Đang lưu...' : 'Lưu chuyên môn'}
                    </button>
                  )}
                </div>

                <div className="detail-list__group">
                  <div className="detail-list__group-title">Lịch sử</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow label="Ngày tạo" value={formatDateTime(user.createdAt)} />
                  <DetailRow
                    label="Đăng nhập cuối"
                    value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa có dữ liệu'}
                  />
                </div>
              </dl>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
