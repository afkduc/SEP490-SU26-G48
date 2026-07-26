import { useEffect, useState } from 'react';
import { adminUsersApi } from '../../../services/adminApi';
import PermissionGate from '../../../components/PermissionGate';
import ResetPasswordModal from './ResetPasswordModal';
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

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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

function DetailRow({ icon, label, value, badge }) {
  return (
    <div className="detail-list__item">
      <dt>
        {icon && (
          <span style={{ opacity: 0.6 }}>{icon}</span>
        )}
        {label}
      </dt>
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const res = await adminUsersApi.getDetail(userId);
        if (!cancelled) setUser(res);
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
              {/* User card */}
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

              {/* Detail list */}
              <dl className="detail-list">
                <div className="detail-list__group">
                  <div className="detail-list__group-title">Thông tin tài khoản</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow
                    label="ID"
                    value={<span className="font-mono">#{user.id}</span>}
                  />
                  <DetailRow
                    label="Email"
                    value={user.email}
                  />
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
                  <DetailRow
                    label="Họ"
                    value={user.firstName || '—'}
                  />
                  <DetailRow
                    label="Tên"
                    value={user.lastName || '—'}
                  />
                  <DetailRow
                    label="Số điện thoại"
                    value={user.phone || '—'}
                  />
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
                  <div className="detail-list__group-title">Lịch sử</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow
                    label="Ngày tạo"
                    value={formatDateTime(user.createdAt)}
                  />
                  <DetailRow
                    label="Đăng nhập cuối"
                    value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa có dữ liệu'}
                  />
                </div>
              </dl>
            </>
          ) : null}
        </div>

        <div className="drawer__footer">
          <PermissionGate permission="admin:users:update">
            <button
              className="drawer__btn-secondary"
              onClick={() => setShowReset(true)}
              type="button"
              disabled={!user?.id}
              title="Tạo mật khẩu mới ngẫu nhiên cho người dùng này"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Đặt lại mật khẩu
            </button>
          </PermissionGate>
        </div>
      </div>

      {showReset && user && (
        <ResetPasswordModal
          user={{ id: user.id, name: fullName, email: user.email }}
          onClose={() => setShowReset(false)}
        />
      )}
    </div>
  );
}
