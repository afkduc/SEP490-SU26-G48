import { useEffect, useState } from 'react';
import { adminUsersApi } from '../../../services/adminApi';

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
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
}

export default function UserDetailDrawer({ userId, onClose }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer drawer--right">
        <div className="drawer__header">
          <h2 className="drawer__title">Chi tiet nguoi dung</h2>
          <button className="drawer__close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="drawer__body">
          {loading ? (
            <div className="drawer__loading">Dang tai chi tiet...</div>
          ) : error ? (
            <div className="drawer__error">{error}</div>
          ) : user ? (
            <dl className="detail-list">
              <div className="detail-list__item">
                <dt>ID</dt>
                <dd><span className="font-mono">#{user.id}</span></dd>
              </div>
              <div className="detail-list__item">
                <dt>Ten dang nhap</dt>
                <dd>{user.name || '—'}</dd>
              </div>
              <div className="detail-list__item">
                <dt>Ho va ten</dt>
                <dd>{user.fullName || '—'}</dd>
              </div>
              <div className="detail-list__item">
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="detail-list__item">
                <dt>So dien thoai</dt>
                <dd>{user.phone || '—'}</dd>
              </div>
              <div className="detail-list__item">
                <dt>Chi nhanh</dt>
                <dd>{user.branchName || '—'}</dd>
              </div>
              <div className="detail-list__item">
                <dt>Role</dt>
                <dd>
                  {user.roles?.length > 0 ? (
                    user.roles.map((r) => (
                      <span key={r} className="badge badge--info" style={{ marginRight: 4 }}>
                        {r}
                      </span>
                    ))
                  ) : '—'}
                </dd>
              </div>
              <div className="detail-list__item">
                <dt>Trang thai</dt>
                <dd>
                  <span className={`badge ${STATUS_CLASS[user.status] || ''}`}>
                    {STATUS_LABELS[user.status] || user.status}
                  </span>
                </dd>
              </div>
              <div className="detail-list__item">
                <dt>Dang nhap cuoi</dt>
                <dd>{formatDateTime(user.lastLoginAt)}</dd>
              </div>
              <div className="detail-list__item">
                <dt>Ngay tao</dt>
                <dd>{formatDateTime(user.createdAt)}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
    </div>
  );
}
