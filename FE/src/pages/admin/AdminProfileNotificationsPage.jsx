import { useState, useEffect, useCallback } from 'react';
import { notificationApi } from '../../services';
import './AdminProfileNotificationsPage.css';

export default function AdminProfileNotificationsPage({ embedded = false } = {}) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationApi.getNotificationSettings();
      setSettings(data);
    } catch (err) {
      setError('Không thể tải cài đặt thông báo');
      console.error('[AdminProfileNotificationsPage] loadSettings error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (key, value) => {
    if (!settings) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  /**
   * Reset ve mac dinh (6 checkbox BAT theo schema DB).
   * Thuc hien nhu data moi -> refetch tu server de dam bao consistency.
   */
  const handleResetDefaults = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const defaults = {
        emailOnLogin: true,
        emailOnFailedLogin: true,
        emailOnRoleChange: true,
        browserOnLogin: true,
        inAppOnSystemAlert: true,
        inAppPasswordChange: true,
      };
      // Thay the dummy userId field = chinh userId dang login (BE tu xac dinh).
      const data = await notificationApi.updateNotificationSettings({
        ...defaults,
      });
      setSettings(data || defaults);
      setSaved(true);
    } catch (err) {
      setError('Đặt lại mặc định thất bại');
      console.error('[AdminProfileNotificationsPage] resetDefaults error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    // Validation: it nhat 1 checkbox phai bat (de tranh user tu tat het
    // va bo luon thong bao bao mat nhu login_failed, role_changed, etc.)
    const anyEnabled = [
      settings.emailOnLogin,
      settings.emailOnFailedLogin,
      settings.emailOnRoleChange,
      settings.browserOnLogin,
      settings.inAppOnSystemAlert,
      settings.inAppPasswordChange,
    ].some((v) => v === true);
    if (!anyEnabled) {
      setError('Phải bật ít nhất 1 kênh thông báo để hệ thống cảnh báo bảo mật.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await notificationApi.updateNotificationSettings(settings);
      setSaved(true);
      await loadSettings();
    } catch (err) {
      setError('Lưu cài đặt thất bại');
      console.error('[AdminProfileNotificationsPage] saveSettings error:', err);
    } finally {
      setSaving(false);
    }
  };

  const titleBlock = (
    <div>
      <h1>Cài đặt thông báo</h1>
      <p className="admin-notifications__subtitle">Quản lý các kênh thông báo của tài khoản</p>
    </div>
  );

  const actionButtons = (
    <div className="admin-notifications__header-actions" style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={handleResetDefaults}
        disabled={saving || !settings}
      >
        Đặt lại mặc định
      </button>
      <button className="btn btn--primary" onClick={handleSave} disabled={saving || !settings}>
        {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className={`admin-notifications${embedded ? ' admin-notifications--embedded' : ''}`}>
        {!embedded && <div className="admin-notifications__header">{titleBlock}</div>}
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Đang tải cài đặt...</p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className={`admin-notifications${embedded ? ' admin-notifications--embedded' : ''}`}>
        {!embedded && <div className="admin-notifications__header">{titleBlock}</div>}
        <div className="error-state">
          <p>{error}</p>
          <button className="btn btn--secondary" onClick={loadSettings}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-notifications${embedded ? ' admin-notifications--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-notifications__header">
          {titleBlock}
          {actionButtons}
        </div>
      )}

      {embedded && <div className="admin-hub__toolbar">{actionButtons}</div>}

      {error && (
        <div className="alert-banner alert-banner--error">
          <span className="alert-banner__icon">!</span>
          <span className="alert-banner__message">{error}</span>
        </div>
      )}

      {saved && (
        <div className="alert-banner alert-banner--success">
          <span className="alert-banner__icon">✓</span>
          <span className="alert-banner__message">Đã lưu cài đặt thông báo</span>
        </div>
      )}

      <div className="notifications-card">
        <div className="notifications-card__section">
          <div className="notifications-card__section-title">Kênh thông báo bảo mật</div>
          <p
            className="notifications-card__section-hint"
            style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 12px' }}
          >
            Các tùy chọn bên dưới bật/tắt thông báo <strong>trong hệ thống</strong> (chuông / danh
            sách). Hiện chưa gửi email SMTP riêng cho các sự kiện này.
          </p>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Đăng nhập thành công</span>
              <span className="notification-row__description">
                Nhận thông báo trong hệ thống khi có đăng nhập mới
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.emailOnLogin ?? true}
              onChange={(e) => handleChange('emailOnLogin', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Đăng nhập thất bại</span>
              <span className="notification-row__description">
                Nhận thông báo khi phát hiện đăng nhập không thành công
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.emailOnFailedLogin ?? true}
              onChange={(e) => handleChange('emailOnFailedLogin', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thay đổi phân quyền</span>
              <span className="notification-row__description">
                Nhận thông báo khi vai trò hoặc quyền truy cập thay đổi
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.emailOnRoleChange ?? true}
              onChange={(e) => handleChange('emailOnRoleChange', e.target.checked)}
            />
          </label>
        </div>

        <div className="notifications-card__section">
          <div className="notifications-card__section-title">Thông báo trên giao diện</div>

          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo đăng nhập</span>
              <span className="notification-row__description">
                Hiển thị thông báo đăng nhập trong hệ thống (pop-up / bell)
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.browserOnLogin ?? true}
              onChange={(e) => handleChange('browserOnLogin', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Cảnh báo bảo mật & thay đổi quyền</span>
              <span className="notification-row__description">
                Hiển thị thông báo đăng nhập thất bại, thiết bị lạ, đăng xuất bất thường, thay đổi
                vai trò trong hệ thống
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.inAppOnSystemAlert ?? true}
              onChange={(e) => handleChange('inAppOnSystemAlert', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo thay đổi mật khẩu</span>
              <span className="notification-row__description">
                Hiển thị thông báo trong hệ thống khi mật khẩu được thay đổi
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.inAppPasswordChange ?? true}
              onChange={(e) => handleChange('inAppPasswordChange', e.target.checked)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
