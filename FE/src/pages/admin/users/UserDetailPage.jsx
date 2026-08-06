import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { adminUsersApi } from '../../../services/adminApi';
import PermissionGate from '../../../components/PermissionGate';
import { useToast } from '../../../components/common/ToastContext';
import { formatPhoneDisplay } from '../../../utils/validation';
import './UserDetailPage.css';

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

function Field({ label, value, badge }) {
  return (
    <div className="user-detail-field">
      <div className="user-detail-field__label">{label}</div>
      <div className="user-detail-field__value">
        {badge ? (
          <span className={`badge ${badge}`}>{value}</span>
        ) : (
          value || <span className="user-detail-field__empty">—</span>
        )}
      </div>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const listSearch = location.state?.fromListSearch || '';
  const backToList = `/admin/users${listSearch}`;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminUsersApi.getDetail(id);
      setUser(res);
    } catch (err) {
      setError(err.message || 'Không tải được chi tiết người dùng');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleToggleStatus() {
    if (!user) return;
    const next = user.status === 'active' ? 'inactive' : 'active';
    const confirmMsg = next === 'inactive'
      ? 'Khóa tài khoản này? User sẽ không thể đăng nhập. (Không có chức năng xóa tài khoản.)'
      : 'Kích hoạt lại tài khoản này?';
    if (!window.confirm(confirmMsg)) return;
    setToggling(true);
    try {
      await adminUsersApi.update({ userId: user.id, status: next });
      toast.success(next === 'inactive' ? 'Đã khóa tài khoản' : 'Đã kích hoạt tài khoản');
      await load();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setToggling(false);
    }
  }

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || '—'
    : '—';

  return (
    <div className="admin-page admin-user-detail-page">
      <div className="admin-user-detail-page__top">
        <button
          type="button"
          className="admin-user-detail-page__back"
          onClick={() => navigate(backToList)}
        >
          ← Quay lại danh sách
        </button>
      </div>

      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <div className="admin-page__title-group">
            <h1>Chi tiết người dùng</h1>
            <p className="admin-page__subtitle">
              Xem hồ sơ và trạng thái. Tài khoản chỉ khóa / kích hoạt — không xóa.
            </p>
          </div>
        </div>
        {user && (
          <div className="admin-page__actions">
            <PermissionGate permission="admin:users:update">
              <button
                type="button"
                className={`btn ${user.status === 'active' ? 'btn--secondary' : 'btn--primary'}`}
                onClick={handleToggleStatus}
                disabled={toggling}
              >
                {toggling ? '...' : (user.status === 'active' ? 'Khóa tài khoản' : 'Kích hoạt')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate(`/admin/users/${user.id}/edit`, { state: { fromListSearch: listSearch } })}
              >
                Sửa
              </button>
            </PermissionGate>
          </div>
        )}
      </div>

      <div className="admin-user-detail-page__card">
        {loading ? (
          <div className="admin-user-detail-page__state">Đang tải chi tiết người dùng</div>
        ) : error ? (
          <div className="admin-user-detail-page__state admin-user-detail-page__state--error">
            {error}
            <div style={{ marginTop: 12 }}>
              <Link to={backToList} className="btn btn--ghost">Về danh sách</Link>
            </div>
          </div>
        ) : user ? (
          <>
            <div className="user-detail-hero">
              <div className="user-detail-hero__avatar">
                {getInitials(user.firstName, user.lastName)}
              </div>
              <div className="user-detail-hero__meta">
                <h2 className="user-detail-hero__name">{fullName}</h2>
                <p className="user-detail-hero__sub">
                  @{user.name}
                  {user.phone ? ` · ${formatPhoneDisplay(user.phone)}` : ''}
                </p>
                {user.roles?.length > 0 && (
                  <div className="user-detail-hero__roles">
                    {user.roles.map((r) => {
                      const name = typeof r === 'object' && r !== null
                        ? (r.roleLabel || r.roleName)
                        : r;
                      const key = typeof r === 'object' && r !== null ? r.roleId : r;
                      return (
                        <span key={key} className="badge badge--info">{name}</span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="user-detail-hero__status">
                <span className={`badge ${STATUS_CLASS[user.status] || ''}`}>
                  {STATUS_LABELS[user.status] || user.status}
                </span>
              </div>
            </div>

            <div className="user-detail-sections">
              <section className="user-detail-section">
                <h3 className="user-detail-section__title">Thông tin tài khoản</h3>
                <div className="user-detail-grid">
                  <Field label="ID" value={<span className="font-mono">#{user.id}</span>} />
                  <Field label="Email" value={user.email} />
                  <Field
                    label="Trạng thái"
                    value={STATUS_LABELS[user.status] || user.status}
                    badge={STATUS_CLASS[user.status] || ''}
                  />
                  <Field label="Tên đăng nhập" value={user.name ? `@${user.name}` : '—'} />
                </div>
              </section>

              <section className="user-detail-section">
                <h3 className="user-detail-section__title">Thông tin cá nhân</h3>
                <div className="user-detail-grid">
                  <Field label="Họ" value={user.firstName || '—'} />
                  <Field label="Tên" value={user.lastName || '—'} />
                  <Field label="Số điện thoại" value={user.phone ? formatPhoneDisplay(user.phone) : '—'} />
                </div>
              </section>

              <section className="user-detail-section">
                <h3 className="user-detail-section__title">Phân công</h3>
                <div className="user-detail-grid">
                  <Field
                    label="Chi nhánh"
                    value={
                      user.scopeAllBranches
                        ? 'Tất cả chi nhánh'
                        : (user.branchName || '—')
                    }
                  />
                  <Field
                    label="Vai trò"
                    value={
                      user.roles?.length
                        ? user.roles.map((r) => (typeof r === 'object' ? (r.roleLabel || r.roleName) : r)).join(', ')
                        : '—'
                    }
                  />
                </div>
              </section>

              <section className="user-detail-section">
                <h3 className="user-detail-section__title">Lịch sử</h3>
                <div className="user-detail-grid">
                  <Field label="Ngày tạo" value={formatDateTime(user.createdAt)} />
                  <Field
                    label="Đăng nhập cuối"
                    value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa có dữ liệu'}
                  />
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
