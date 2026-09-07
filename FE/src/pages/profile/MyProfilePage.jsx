import { useEffect, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  useAuth,
  getRoleProfilePath,
  getRoleProfileEditPath,
} from '../../contexts/AppContext';
import { getMyProfile, updateMyProfile, logoutAllMyDevices } from '../../services/profileApi';
import { syncProfileSession } from '../../utils/profileSession';
import {
  isRoleProfilePath,
  isProfileNotificationsPath,
  isProfileEditPath,
} from '../../utils/profilePaths';
import { useCrmSearchSync } from '../../utils/crmUrl';
import { useToast } from '../../components/common/ToastContext';
import { useConfirm } from '../../components/common/ConfirmDialog';
import {
  EMAIL_HINT,
  getPersonNameError,
  isValidEmail,
  isValidPhone,
  phoneDigitsOnly,
  NAME_MAX_LENGTH,
  PERSON_NAME_HINT,
} from '../../utils/validation';
import './MyProfilePage.css';

const IconUser = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconMail = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconPhone = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.59a16 16 0 0 0 6 6l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const IconShield = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconBranch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconCalendar = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconCheck = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconAlert = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconEdit = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  } catch {
    return value;
  }
}

function getInitials(firstName, lastName) {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return f || l ? `${f}${l}` : '?';
}

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Không hoạt động',
  locked: 'Bị khóa',
};

function AlertBanner({ message, type = 'error', onClose }) {
  if (!message) return null;
  return (
    <div className={`alert-banner alert-banner--${type}`}>
      <span className="alert-banner__icon">
        {type === 'success' ? <IconCheck /> : <IconAlert />}
      </span>
      <span className="alert-banner__message">{message}</span>
      {onClose && (
        <button type="button" className="alert-banner__close" onClick={onClose}>×</button>
      )}
    </div>
  );
}

/**
 * UI hồ sơ dùng chung (không tự đổi mật khẩu — dùng Quên mật khẩu / admin reset).
 * Mỗi role có page riêng (ManagerProfilePage, …) bọc component này.
 */
export default function MyProfilePage({
  embedded = false,
  title = 'Hồ sơ cá nhân',
  subtitle = 'Xem và chỉnh sửa thông tin tài khoản',
} = {}) {
  const { user, setUser, reloadPermissions, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const syncSearch = useCrmSearchSync();
  const location = useLocation();
  const navigate = useNavigate();
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const profileBasePath = getRoleProfilePath(user);
  const profileEditPath = getRoleProfileEditPath(user);
  const isEditMode = location.pathname.endsWith('/edit');
  const [localTab, setLocalTab] = useState('view');
  const activeTab = isEditMode ? 'edit' : localTab;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    if (isProfileNotificationsPath(path, location.search)) return;
    if (!isRoleProfilePath(path)) return;

    const viewPath = getRoleProfilePath(user);
    const editPath = getRoleProfileEditPath(user);

    if (isProfileEditPath(path)) {
      if (path !== editPath) navigate(editPath, { replace: true });
      return;
    }
    if (path !== viewPath) {
      navigate(viewPath, { replace: true });
    }
  }, [user, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (searchParams.get('tab') !== 'edit') return;
    if (isEditMode) {
      if (searchParams.get('tab')) {
        syncSearch(new URLSearchParams(), { replace: true });
      }
      return;
    }
    navigate(profileEditPath, { replace: true });
  }, [searchParams, isEditMode, navigate, profileEditPath, syncSearch]);

  const [editForm, setEditForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getMyProfile();
        if (!cancelled) {
          setProfile(data);
          setEditForm({
            email: data.email || '',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            phone: data.phone || '',
          });
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Không thể tải thông tin cá nhân');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleTabChange(tab) {
    setEditError(null);
    setEditSuccess(null);

    if (tab === 'edit') {
      setLocalTab('view');
      if (!isEditMode) navigate(profileEditPath);
    } else {
      setLocalTab(tab === 'password' ? 'view' : tab);
      if (isEditMode) navigate(profileBasePath);
    }

    if (searchParams.get('tab') || searchParams.get('reason')) {
      const next = new URLSearchParams(searchParams);
      next.delete('reason');
      next.delete('tab');
      syncSearch(next, { replace: true });
    }
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    let next = value;
    if (name === 'phone') next = phoneDigitsOnly(value);
    if (name === 'firstName' || name === 'lastName') next = value.slice(0, NAME_MAX_LENGTH);
    setEditForm((f) => ({ ...f, [name]: next }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    const phone = phoneDigitsOnly(editForm.phone);
    const email = editForm.email.trim();
    const firstName = editForm.firstName.trim().replace(/\s+/g, ' ');
    const lastName = editForm.lastName.trim().replace(/\s+/g, ' ');
    if (!email) {
      setEditError('Email là bắt buộc');
      return;
    }
    if (!isValidEmail(email)) {
      setEditError(EMAIL_HINT);
      return;
    }
    if (!phone) {
      setEditError('Số điện thoại là bắt buộc');
      return;
    }
    if (!isValidPhone(phone)) {
      setEditError('Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số');
      return;
    }
    const firstNameErr = getPersonNameError(firstName, { required: false, label: 'Họ' });
    if (firstNameErr) {
      setEditError(firstNameErr);
      return;
    }
    const lastNameErr = getPersonNameError(lastName, { required: false, label: 'Tên' });
    if (lastNameErr) {
      setEditError(lastNameErr);
      return;
    }

    setEditLoading(true);
    try {
      const payload = { email, phone };
      if (firstName) payload.firstName = firstName;
      if (lastName) payload.lastName = lastName;

      const updated = await updateMyProfile(payload);
      setProfile(updated);
      setEditSuccess('Cập nhật thông tin thành công!');
      syncProfileSession(user, updated, setUser);
      if (typeof reloadPermissions === 'function') reloadPermissions();

      if (isEditMode && location.pathname !== profileEditPath) {
        navigate(profileEditPath, { replace: true });
      }
      setTimeout(() => setEditSuccess(null), 3000);
    } catch (err) {
      setEditError(err.message || 'Không thể cập nhật thông tin');
    } finally {
      setEditLoading(false);
    }
  }

  const displayName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.userName
    : user?.name || '—';

  const initials = profile
    ? getInitials(profile.firstName, profile.lastName)
    : '?';

  async function handleLogoutAllDevices() {
    const ok = await confirm({
      title: 'Đăng xuất mọi thiết bị',
      message: 'Đăng xuất mọi thiết bị, kể cả máy này?',
      detail: 'Bạn sẽ phải đăng nhập lại trên tất cả thiết bị.',
      confirmText: 'Đăng xuất tất cả',
      tone: 'danger',
    });
    if (!ok) return;

    setLoggingOutAll(true);
    try {
      await logoutAllMyDevices();
      toast.success('Đã đăng xuất mọi thiết bị');
      await logout();
    } catch (err) {
      toast.error(err?.message || 'Không thể đăng xuất mọi thiết bị');
    } finally {
      setLoggingOutAll(false);
    }
  }

  return (
    <div className={`admin-profile${embedded ? ' admin-profile--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-profile__header">
          <div className="admin-profile__title-block">
            <div className="admin-profile__title-icon">
              <IconUser size={22} />
            </div>
            <div>
              <h1>{title}</h1>
              <p className="admin-profile__subtitle">{subtitle}</p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="admin-profile__loading">
          <div className="loading-spinner" />
          <span>Đang tải thông tin...</span>
        </div>
      )}

      {loadError && !loading && (
        <AlertBanner type="error" message={loadError} />
      )}

      {!loading && !loadError && profile && (
        <div className="admin-profile__layout">
          <div className="profile-card profile-card--left">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">{initials}</div>
              <div className="profile-avatar__badge">
                <IconShield />
              </div>
            </div>

            <div className="profile-card__name">{displayName}</div>
            <div className="profile-card__username">@{profile.userName}</div>

            <div className="profile-card__meta-list">
              <div className="profile-card__meta-item">
                <span className="profile-card__meta-icon"><IconMail /></span>
                <span className="profile-card__meta-value">{profile.email || '—'}</span>
              </div>
              <div className="profile-card__meta-item">
                <span className="profile-card__meta-icon"><IconPhone /></span>
                <span className="profile-card__meta-value">{profile.phone || '—'}</span>
              </div>
              <div className="profile-card__meta-item profile-card__meta-item--branch">
                <span className="profile-card__meta-icon"><IconBranch /></span>
                <span className="profile-card__meta-value">
                  {profile.assignedBranches?.length
                    ? `${profile.assignedBranches.length} chi nhánh`
                    : profile.branchName || '—'}
                </span>
              </div>
              <div className="profile-card__meta-item">
                <span className="profile-card__meta-icon"><IconCalendar /></span>
                <span className="profile-card__meta-value">{formatDate(profile.createdAt)}</span>
              </div>
            </div>

            {profile.assignedBranches?.length > 0 && (
              <div className="profile-card__branches">
                {profile.assignedBranches.map((b) => {
                  const isPrimary = Number(b.branchId) === Number(profile.branchId);
                  return (
                    <span
                      key={b.branchId}
                      className={`branch-chip ${isPrimary ? 'branch-chip--primary' : ''}`}
                      title={isPrimary ? 'Chi nhánh chính' : 'Chi nhánh được phân công'}
                    >
                      <IconBranch size={12} />
                      {b.branchName}
                      {isPrimary && <span className="branch-chip__star">★</span>}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="profile-card__roles">
              {profile.roles?.map((r) => (
                <span key={r.name} className="role-badge">
                  <IconShield size={12} />
                  {r.label || r.name}
                </span>
              ))}
            </div>

            <div className="profile-card__status">
              <span className={`status-badge status-badge--${profile.status}`}>
                {STATUS_LABELS[profile.status] || profile.status}
              </span>
            </div>

            <button
              type="button"
              className="btn btn--primary profile-card__edit-btn"
              onClick={() => handleTabChange('edit')}
            >
              <IconEdit />
              Chỉnh sửa hồ sơ
            </button>
            <button
              type="button"
              className="btn btn--secondary profile-card__logout-all-btn"
              disabled={loggingOutAll}
              onClick={handleLogoutAllDevices}
            >
              {loggingOutAll ? 'Đang xử lý...' : 'Đăng xuất mọi thiết bị'}
            </button>
          </div>

          <div className="profile-card profile-card--right">
            <div className="profile-tabs">
              <button
                type="button"
                className={`profile-tabs__btn ${activeTab === 'view' ? 'profile-tabs__btn--active' : ''}`}
                onClick={() => handleTabChange('view')}
              >
                <IconUser size={15} />
                Thông tin
              </button>
              <button
                type="button"
                className={`profile-tabs__btn ${activeTab === 'edit' ? 'profile-tabs__btn--active' : ''}`}
                onClick={() => handleTabChange('edit')}
              >
                <IconEdit size={15} />
                Chỉnh sửa
              </button>
            </div>

            {activeTab === 'view' && (
              <div className="profile-tab-content">
                <div className="profile-info-grid">
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Họ</span>
                    <span className="profile-info-item__value">{profile.firstName || '—'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Tên</span>
                    <span className="profile-info-item__value">{profile.lastName || '—'}</span>
                  </div>
                  <div className="profile-info-item profile-info-item--full">
                    <span className="profile-info-item__label">Email</span>
                    <span className="profile-info-item__value">{profile.email || '—'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Số điện thoại</span>
                    <span className="profile-info-item__value">{profile.phone || '—'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Chi nhánh</span>
                    <span className="profile-info-item__value">{profile.branchName || '—'}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Tên đăng nhập</span>
                    <span className="profile-info-item__value profile-info-item__value--mono">@{profile.userName}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Trạng thái</span>
                    <span className="profile-info-item__value">
                      <span className={`status-badge status-badge--${profile.status}`}>
                        {STATUS_LABELS[profile.status] || profile.status}
                      </span>
                    </span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Ngày tạo</span>
                    <span className="profile-info-item__value">{formatDateTime(profile.createdAt)}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-item__label">Cập nhật lần cuối</span>
                    <span className="profile-info-item__value">{formatDateTime(profile.updatedAt || profile.createdAt)}</span>
                  </div>
                  <div className="profile-info-item profile-info-item--full">
                    <span className="profile-info-item__label">Vai trò</span>
                    <span className="profile-info-item__value">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {profile.roles?.map((r) => (
                          <span key={r.name} className="role-badge">
                            {r.label || r.name}
                          </span>
                        ))}
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'edit' && (
              <div className="profile-tab-content">
                {editSuccess && (
                  <AlertBanner type="success" message={editSuccess} onClose={() => setEditSuccess(null)} />
                )}
                {editError && (
                  <AlertBanner type="error" message={editError} onClose={() => setEditError(null)} />
                )}

                <form className="profile-form" onSubmit={handleEditSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="firstName">Họ</label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        className="form-input"
                        value={editForm.firstName}
                        onChange={handleEditChange}
                        placeholder="Nhập họ"
                        maxLength={NAME_MAX_LENGTH}
                        title={PERSON_NAME_HINT}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="lastName">Tên</label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        className="form-input"
                        value={editForm.lastName}
                        onChange={handleEditChange}
                        placeholder="Nhập tên"
                        maxLength={NAME_MAX_LENGTH}
                        title={PERSON_NAME_HINT}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="email">
                      <span className="form-label__icon" aria-hidden="true"><IconMail /></span>
                      Email <span className="required">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="form-input"
                      value={editForm.email}
                      onChange={handleEditChange}
                      placeholder="email@example.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">
                      <span className="form-label__icon" aria-hidden="true"><IconPhone /></span>
                      Số điện thoại <span className="required">*</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="form-input"
                      value={editForm.phone}
                      onChange={handleEditChange}
                      placeholder="0xxxxxxxxx"
                      required
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </div>

                  <div className="profile-form__readonly">
                    <div className="form-group">
                      <label className="form-label">Tên đăng nhập</label>
                      <input
                        type="text"
                        className="form-input form-input--readonly"
                        value={profile.userName}
                        readOnly
                        title="Tên đăng nhập không thể thay đổi"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Chi nhánh</label>
                      <input
                        type="text"
                        className="form-input form-input--readonly"
                        value={profile.branchName || '—'}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="profile-form__actions">
                    <button type="submit" className="btn btn--primary" disabled={editLoading}>
                      {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
