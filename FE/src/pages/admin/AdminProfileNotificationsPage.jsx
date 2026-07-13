import { useState } from 'react';
import './AdminProfileNotificationsPage.css';

const DEFAULT_SETTINGS = {
  emailOnLogin: true,
  emailOnFailedLogin: true,
  emailOnRoleChange: true,
  browserOnLogin: true,
  inAppOnSystemAlert: true,
};

export default function AdminProfileNotificationsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSaved(true);
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

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
          disabled={saving}
        >
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>

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
              checked={settings.emailOnLogin}
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
              checked={settings.emailOnFailedLogin}
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
              checked={settings.emailOnRoleChange}
              onChange={(e) => handleChange('emailOnRoleChange', e.target.checked)}
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
              checked={settings.browserOnLogin}
              onChange={(e) => handleChange('browserOnLogin', e.target.checked)}
            />
          </label>
          <label className="notification-row">
            <span className="notification-row__label">
              <span className="notification-row__title">Thông báo cảnh báo hệ thống</span>
              <span className="notification-row__description">Hiển thị cảnh báo trong hệ thống khi có sự cố</span>
            </span>
            <input
              type="checkbox"
              checked={settings.inAppOnSystemAlert}
              onChange={(e) => handleChange('inAppOnSystemAlert', e.target.checked)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
