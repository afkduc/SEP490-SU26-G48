import { useEffect, useState } from 'react';
import { adminUsersApi } from '../../../services/adminApi';
import AssignRoleModal from './AssignRoleModal';

const STATUS_LABELS = {
  active: 'Hoat dong',
  inactive: 'Ngung hoat dong',
  locked: 'Bi khoa',
};

const STATUS_CLASS = {
  active: 'badge--success',
  inactive: 'badge--secondary',
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
  const [showAssign, setShowAssign] = useState(false);

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
        if (!cancelled) setError(err.message || 'Khong tai duoc chi tiet nguoi dung');
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
            <h2 className="drawer__title">Chi tiet nguoi dung</h2>
          </div>
          <button className="drawer__close" onClick={onClose} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="drawer__body">
          {loading ? (
            <div className="drawer__loading">Dang tai chi tiet nguoi dung</div>
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
                    {user.roles.map((r) => (
                      <span key={r} className="badge badge--info">{r}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail list */}
              <dl className="detail-list">
                <div className="detail-list__group">
                  <div className="detail-list__group-title">Thong tin tai khoan</div>
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
                    label="Trang thai"
                    value={STATUS_LABELS[user.status] || user.status}
                    badge={STATUS_CLASS[user.status] || ''}
                  />
                </div>

                <div className="detail-list__group">
                  <div className="detail-list__group-title">Thong tin ca nhan</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow
                    label="Ho"
                    value={user.firstName || '—'}
                  />
                  <DetailRow
                    label="Ten"
                    value={user.lastName || '—'}
                  />
                  <DetailRow
                    label="So dien thoai"
                    value={user.phone || '—'}
                  />
                </div>

                <div className="detail-list__group">
                  <div className="detail-list__group-title">Phan cong</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow
                    label="Chi nhanh"
                    value={user.branchName || '—'}
                  />
                </div>

                <div className="detail-list__group">
                  <div className="detail-list__group-title">Lich su</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow
                    label="Ngay tao"
                    value={formatDateTime(user.createdAt)}
                  />
                  <DetailRow
                    label="Dang nhap cuoi"
                    value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chua dang nhap'}
                  />
                </div>
              </dl>
            </>
          ) : null}
        </div>

        <div className="drawer__footer">
          <button className="drawer__btn-assign" onClick={() => setShowAssign(true)} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Phan quyen
          </button>
        </div>
      </div>

      {showAssign && user && (
        <AssignRoleModal
          userId={user.id}
          onClose={() => setShowAssign(false)}
          onSuccess={() => {
            onRolesChanged?.();
            onClose?.();
          }}
        />
      )}
    </div>
  );
}
