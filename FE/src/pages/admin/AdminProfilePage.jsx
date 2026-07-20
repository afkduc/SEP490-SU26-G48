import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { getMyProfile, updateMyProfile, changePassword } from '../../services/profileApi';
import './AdminProfilePage.css';

// ─── Icons ────────────────────────────────────────────────────────────────────

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

const IconLock = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconEye = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconEyeOff = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
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

const IconSuccess = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconEdit = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
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
  inactive: 'Ngừng hoạt động',
  locked: 'Bị khóa',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertBanner({ message, type = 'error', onClose }) {
  if (!message) return null;
  return (
    <div className={`alert-banner alert-banner--${type}`}>
      <span className="alert-banner__icon">
        {type === 'success' ? <IconCheck /> : <IconAlert />}
      </span>
      <span className="alert-banner__message">{message}</span>
      {onClose && (
        <button className="alert-banner__close" onClick={onClose}>×</button>
      )}
    </div>
  );
}

function PasswordInput({ label, id, value, onChange, placeholder, error }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`form-group ${error ? 'form-group--error' : ''}`}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="input-wrapper">
        <span className="input-icon"><IconLock /></span>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`form-input form-input--icon ${error ? 'form-input--error' : ''}`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="input-toggle-visibility"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminProfilePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Hien thi banner neu bi redirect tu login vi mustChangePassword=true
  const forcedChange = searchParams.get('reason') === 'forced';

  // Tab: 'view' | 'edit' | 'password'
  // Doc tu query param ?tab=edit de auto switch khi can.
  // Tab 'password' da bi an (se lam luong rieng qua email) -> fallback 'view'.
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    initialTab === 'edit' ? 'edit' : 'view'
  );

  // Edit form state
  const [editForm, setEditForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);

  // Password form state
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwErrors, setPwErrors] = useState({});
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(null);

  // Load profile on mount
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

  // Switch tab resets messages
  // Tab 'password' bi an nen neu co ai do goi handleTabChange('password') qua
  // query param cu, fallback ve 'view' de tranh render content bi an.
  function handleTabChange(tab) {
    const safeTab = tab === 'password' ? 'view' : tab;
    setActiveTab(safeTab);
    setEditError(null);
    setEditSuccess(null);
    setPwSuccess(null);
    setPwErrors({});
    // Clear query param ?tab= khi user tu chuyen tab (giu URL sach)
    if (searchParams.get('tab') || searchParams.get('reason')) {
      setSearchParams({}, { replace: true });
    }
  }

  // Edit form handlers
  function handleEditChange(e) {
    setEditForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);
    setEditLoading(true);

    try {
      const payload = {};
      if (editForm.email.trim()) payload.email = editForm.email.trim();
      if (editForm.firstName.trim()) payload.firstName = editForm.firstName.trim();
      if (editForm.lastName.trim()) payload.lastName = editForm.lastName.trim();
      if (editForm.phone.trim()) payload.phone = editForm.phone.trim();

      const updated = await updateMyProfile(payload);
      setProfile(updated);
      setEditSuccess('Cập nhật thông tin thành công!');

      // Update localStorage user so Navbar/AppContext picks up the change on next reload
      try {
        const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (raw) {
          const parsed = JSON.parse(raw);
          const updatedUser = {
            ...parsed,
            email: updated.email,
            name: `${updated.firstName || ''} ${updated.lastName || ''}`.trim(),
          };
          const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
          storage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (_) {}

      setTimeout(() => setEditSuccess(null), 3000);
    } catch (err) {
      setEditError(err.message || 'Không thể cập nhật thông tin');
    } finally {
      setEditLoading(false);
    }
  }

  // Password form handlers
  function handlePwChange(e) {
    setPwForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (pwErrors[e.target.name]) {
      setPwErrors((err) => ({ ...err, [e.target.name]: null }));
    }
  }

  async function handlePwSubmit(e) {
    e.preventDefault();
    setPwSuccess(null);

    const errors = {};
    if (!pwForm.currentPassword) errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
    if (!pwForm.newPassword) errors.newPassword = 'Vui lòng nhập mật khẩu mới';
    else if (pwForm.newPassword.length < 6) errors.newPassword = 'Mật khẩu mới phải ít nhất 6 ký tự';
    if (!pwForm.confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    else if (pwForm.newPassword !== pwForm.confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận không khớp';

    if (Object.keys(errors).length > 0) {
      setPwErrors(errors);
      return;
    }

    setPwLoading(true);
    try {
      await changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwSuccess('Đổi mật khẩu thành công!');
      setTimeout(() => setPwSuccess(null), 4000);
    } catch (err) {
      setPwErrors({ global: err.message || 'Không thể đổi mật khẩu' });
    } finally {
      setPwLoading(false);
    }
  }

  const displayName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.userName
    : user?.name || '—';

  const initials = profile
    ? getInitials(profile.firstName, profile.lastName)
    : '?';

  return (
    <div className="admin-profile">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="admin-profile__header">
        <div className="admin-profile__title-block">
          <div className="admin-profile__title-icon">
            <IconUser size={22} />
          </div>
          <div>
            <h1>Hồ sơ cá nhân</h1>
            <p className="admin-profile__subtitle">Xem và chỉnh sửa thông tin tài khoản</p>
          </div>
        </div>
      </div>

      {/* ── Loading / Error ─────────────────────────────────────── */}
      {loading && (
        <div className="admin-profile__loading">
          <div className="loading-spinner" />
          <span>Đang tải thông tin...</span>
        </div>
      )}

      {loadError && !loading && (
        <AlertBanner type="error" message={loadError} />
      )}

      {/* ── Profile layout ──────────────────────────────────────── */}
      {!loading && !loadError && profile && (
        <div className="admin-profile__layout">
          {/* ── Left: avatar card ──────────────────────────────── */}
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
              <div className="profile-card__meta-item">
                <span className="profile-card__meta-icon"><IconBranch /></span>
                <span className="profile-card__meta-value">{profile.branchName || '—'}</span>
              </div>
              <div className="profile-card__meta-item">
                <span className="profile-card__meta-icon"><IconCalendar /></span>
                <span className="profile-card__meta-value">{formatDate(profile.createdAt)}</span>
              </div>
            </div>

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

            {/* Quick edit button */}
            <button
              className="btn btn--primary profile-card__edit-btn"
              onClick={() => handleTabChange('edit')}
            >
              <IconEdit />
              Chỉnh sửa hồ sơ
            </button>
          </div>

          {/* ── Right: tab content ─────────────────────────────── */}
          <div className="profile-card profile-card--right">
            {/* Tab bar */}
            <div className="profile-tabs">
              <button
                className={`profile-tabs__btn ${activeTab === 'view' ? 'profile-tabs__btn--active' : ''}`}
                onClick={() => handleTabChange('view')}
              >
                <IconUser size={15} />
                Thông tin
              </button>
              <button
                className={`profile-tabs__btn ${activeTab === 'edit' ? 'profile-tabs__btn--active' : ''}`}
                onClick={() => handleTabChange('edit')}
              >
                <IconEdit size={15} />
                Chỉnh sửa
              </button>
              {/* Tab "Đổi mật khẩu" đã được ẩn theo yêu cầu — sẽ làm luồng */}
              {/* riêng (qua email) sau, KHÔNG xóa component để dễ bật lại. */}
              {false && (
                <button
                  className={`profile-tabs__btn ${activeTab === 'password' ? 'profile-tabs__btn--active' : ''}`}
                  onClick={() => handleTabChange('password')}
                >
                  <IconLock size={15} />
                  Đổi mật khẩu
                </button>
              )}
            </div>

            {/* ── Tab: View ───────────────────────────────── */}
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
                    <span className="profile-info-item__label">Vai tro</span>
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

            {/* ── Tab: Edit ────────────────────────────────── */}
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
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="email">Email <span className="required">*</span></label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconMail /></span>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className="form-input form-input--icon"
                        value={editForm.email}
                        onChange={handleEditChange}
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">Số điện thoại</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconPhone /></span>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className="form-input form-input--icon"
                        value={editForm.phone}
                        onChange={handleEditChange}
                        placeholder="0xxxxxxxxx"
                      />
                    </div>
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
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={editLoading}
                    >
                      {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Tab: Password ───────────────────────────── */}
            {activeTab === 'password' && (
              <div className="profile-tab-content">
                {forcedChange && !pwSuccess && (
                  <AlertBanner
                    type="error"
                    message="Bạn phải đổi mật khẩu trước khi tiếp tục sử dụng hệ thống. Mật khẩu hiện tại là mật khẩu tạm do quản trị viên cấp."
                  />
                )}
                {pwErrors.global && (
                  <AlertBanner type="error" message={pwErrors.global} onClose={() => setPwErrors({})} />
                )}
                {pwSuccess && (
                  <AlertBanner type="success" message={pwSuccess} onClose={() => setPwSuccess(null)} />
                )}

                <div className="password-hint">
                  <IconLock size={16} />
                  <span>Mật khẩu phải có ít nhất <strong>6 ký tự</strong>. Không sử dụng mật khẩu đã từng sử dụng trước đó.</span>
                </div>

                <form className="profile-form" onSubmit={handlePwSubmit}>
                  <PasswordInput
                    id="currentPassword"
                    label="Mật khẩu hiện tại"
                    value={pwForm.currentPassword}
                    onChange={handlePwChange}
                    placeholder="Nhập mật khẩu hiện tại"
                    error={pwErrors.currentPassword}
                  />

                  <PasswordInput
                    id="newPassword"
                    label="Mật khẩu mới"
                    value={pwForm.newPassword}
                    onChange={handlePwChange}
                    placeholder="Ít nhất 6 ký tự"
                    error={pwErrors.newPassword}
                  />

                  <PasswordInput
                    id="confirmPassword"
                    label="Xác nhận mật khẩu mới"
                    value={pwForm.confirmPassword}
                    onChange={handlePwChange}
                    placeholder="Nhập lại mật khẩu mới"
                    error={pwErrors.confirmPassword}
                  />

                  <div className="profile-form__actions">
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={pwLoading}
                    >
                      {pwLoading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
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
