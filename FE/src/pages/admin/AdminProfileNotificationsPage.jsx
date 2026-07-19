import { useState, useEffect, useCallback } from 'react';
import { notificationApi } from '../../services';
import './AdminProfileNotificationsPage.css';

export default function AdminProfileNotificationsPage() {
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

  const handleSave = async () => {
    if (!settings) return;
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

  if (loading) {
    return (
      <div className="admin-notifications">
        <div className="admin-notifications__header">
          <div>
            <h1>Cài đặt thông báo</h1>
            <p className="admin-notifications__subtitle">Quản lý các kênh thông báo của tài khoản</p>
          </div>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Đang tải cài đặt...</p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="admin-notifications">
        <div className="admin-notifications__header">
          <div>
            <h1>Cài đặt thông báo</h1>
            <p className="admin-notifications__subtitle">Quản lý các kênh thông báo của tài khoản</p>
          </div>
        </div>
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
    <div className="admin-notifications">
      <div className="admin-notifications__header">
        <div>
          <h1>Cài đặt thông báo</h1>
          <p className="admin-notifications__subtitle">Quản lý các kênh thông báo của tài khoản</p>
        </div>
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={saving || !settings}
        >
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>

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
          <div className="notifications-card__section-title">Thông báo email</div>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo đăng nhập thành công</span>
              <span className="notification-row__description">Gửi email khi có đăng nhập mới vào hệ thống</span>
            </span>
            <input
              type="checkbox"
              checked={settings?.emailOnLogin ?? true}
              onChange={(e) => handleChange('emailOnLogin', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Cảnh báo đăng nhập thất bại</span>
              <span className="notification-row__description">Gửi email khi phát hiện đăng nhập không thành công</span>
            </span>
            <input
              type="checkbox"
              checked={settings?.emailOnFailedLogin ?? true}
              onChange={(e) => handleChange('emailOnFailedLogin', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo thay đổi phân quyền</span>
              <span className="notification-row__description">Gửi email khi vai trò hoặc quyền truy cập thay đổi</span>
            </span>
            <input
              type="checkbox"
              checked={settings?.emailOnRoleChange ?? true}
              onChange={(e) => handleChange('emailOnRoleChange', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo thay đổi mật khẩu</span>
              <span className="notification-row__description">Gửi email khi mật khẩu được thay đổi</span>
            </span>
            <input
              type="checkbox"
              checked={settings?.emailOnPasswordChange ?? true}
              onChange={(e) => handleChange('emailOnPasswordChange', e.target.checked)}
            />
          </label>
        </div>

        <div className="notifications-card__section">
          <div className="notifications-card__section-title">Thông báo trong hệ thống</div>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo đăng nhập</span>
              <span className="notification-row__description">Hiển thị thông báo đăng nhập trong hệ thống</span>
            </span>
            <input
              type="checkbox"
              checked={settings?.inAppLogin ?? true}
              onChange={(e) => handleChange('inAppLogin', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo cảnh báo bảo mật</span>
              <span className="notification-row__description">Hiển thị cảnh báo bảo mật (thiết bị lạ, đăng nhập bất thường)</span>
            </span>
            <input
              type="checkbox"
              checked={settings?.inAppSecurityAlert ?? true}
              onChange={(e) => handleChange('inAppSecurityAlert', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo thay đổi phân quyền</span>
              <span className="notification-row__description">Hiển thị thông báo khi vai trò thay đổi</span>
            </span>
            <input
              type="checkbox"
              checked={settings?.inAppRoleChange ?? true}
              onChange={(e) => handleChange('inAppRoleChange', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo thay đổi mật khẩu</span>
              <span className="notification-row__description">Hiển thị thông báo khi mật khẩu được thay đổi</span>
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
