const { query, transaction } = require('../database/sqlServer');

const SETTINGS_COLUMNS = `
  user_id,
  email_on_login,
  email_on_failed_login,
  email_on_role_change,
  browser_on_login,
  in_app_on_system_alert,
  in_app_password_change,
  created_at,
  updated_at
`;

function toSettingsRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    emailOnLogin: Boolean(row.email_on_login),
    emailOnFailedLogin: Boolean(row.email_on_failed_login),
    emailOnRoleChange: Boolean(row.email_on_role_change),
    browserOnLogin: Boolean(row.browser_on_login),
    inAppOnSystemAlert: Boolean(row.in_app_on_system_alert),
    inAppPasswordChange: Boolean(row.in_app_password_change),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDefaultSettings(userId) {
  return {
    userId,
    emailOnLogin: true,
    emailOnFailedLogin: true,
    emailOnRoleChange: true,
    browserOnLogin: true,
    inAppOnSystemAlert: true,
    inAppPasswordChange: true,
  };
}

class NotificationSettingsRepository {
  /**
   * Lấy settings của user. Nếu chưa có, trả về default.
   */
  async findByUserId(userId) {
    const result = await query(
      `SELECT ${SETTINGS_COLUMNS}
       FROM   user_notification_settings
       WHERE  user_id = @p1`,
      { p1: userId }
    );
    const row = result.recordset[0];
    if (row) {
      return toSettingsRow(row);
    }
    return getDefaultSettings(userId);
  }

  /**
   * Tạo settings mới với giá trị mặc định
   */
  async create(userId) {
    await query(
      `INSERT INTO user_notification_settings (user_id) VALUES (@p1)`,
      { p1: userId }
    );
    return this.findByUserId(userId);
  }

  /**
   * Upsert settings - tạo nếu chưa có, cập nhật nếu đã có
   */
  async upsert(userId, settings) {
    const existing = await query(
      `SELECT 1 FROM user_notification_settings WHERE user_id = @p1`,
      { p1: userId }
    );

    if (existing.recordset.length === 0) {
      await this.create(userId);
    }

    return this.updatePartial(userId, settings);
  }

  /**
   * Cập nhật partial - chỉ cập nhật những field được truyền vào
   */
  async updatePartial(userId, changedFields) {
    const updates = [];
    const params = {};
    let p = 1;

    const fieldMap = {
      emailOnLogin: 'email_on_login',
      emailOnFailedLogin: 'email_on_failed_login',
      emailOnRoleChange: 'email_on_role_change',
      browserOnLogin: 'browser_on_login',
      inAppOnSystemAlert: 'in_app_on_system_alert',
      inAppPasswordChange: 'in_app_password_change',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (changedFields.hasOwnProperty(key)) {
        updates.push(`${dbField} = @p${p}`);
        params[`p${p}`] = changedFields[key] ? 1 : 0;
        p++;
      }
    }

    if (updates.length === 0) {
      return this.findByUserId(userId);
    }

    updates.push('updated_at = SYSUTCDATETIME()');
    params[`p${p}`] = userId;

    await query(
      `UPDATE user_notification_settings SET ${updates.join(', ')} WHERE user_id = @p${p}`,
      params
    );

    return this.findByUserId(userId);
  }
}

module.exports = NotificationSettingsRepository;
