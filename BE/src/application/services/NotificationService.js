const NotificationSettingsRepository = require('../../infrastructure/repositories/NotificationSettingsRepository');
const NotificationRepository = require('../../infrastructure/repositories/NotificationRepository');
const { query } = require('../../infrastructure/database/sqlServer');

// Mapping event -> DB column key thực sự tồn tại trong user_notification_settings.
const IN_APP_SYSTEM_ALERT = 'inAppOnSystemAlert';
const IN_APP_PASSWORD_CHANGE = 'inAppPasswordChange';
const BROWSER_ON_LOGIN = 'browserOnLogin';
const EMAIL_ON_LOGIN = 'emailOnLogin';
const EMAIL_ON_FAILED_LOGIN = 'emailOnFailedLogin';
const EMAIL_ON_ROLE_CHANGE = 'emailOnRoleChange';

// Severity levels cho notification — map voi mau sac o frontend
// success  = xanh lá  (#10b981) — tạo mới thành công
// info     = xanh dương (#3b82f6) — cập nhật thông tin
// warning  = vàng       (#f59e0b) — cảnh báo nhẹ
// error    = đỏ        (#ef4444) — disable/delete/thất bại
// critical = đỏ đậm   (#dc2626) — cảnh báo nghiêm trọng
const SEVERITY = {
  SUCCESS:  'success',
  INFO:     'info',
  WARNING:  'warning',
  ERROR:    'error',
  CRITICAL: 'critical',
};

const NOTIFICATION_EVENTS = {
  // --- Auth events (existing) ---
  LOGIN_SUCCESS: {
    title: 'Đăng nhập thành công',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: 'Bạn đã đăng nhập vào hệ thống.',
      withDevice: 'Bạn đã đăng nhập từ thiết bị mới: {device}.',
    },
    affectsSettings: [EMAIL_ON_LOGIN, BROWSER_ON_LOGIN],
  },
  LOGIN_FAILED: {
    title: 'Cảnh báo đăng nhập',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: 'Có {count} lần đăng nhập thất bại cho tài khoản của bạn.',
    },
    affectsSettings: [EMAIL_ON_FAILED_LOGIN, IN_APP_SYSTEM_ALERT],
  },
  NEW_DEVICE: {
    title: 'Đăng nhập từ thiết bị mới',
    severity: SEVERITY.WARNING,
    messageTemplates: {
      default: 'Phát hiện đăng nhập từ thiết bị mới: {device} từ {location}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  FORCE_LOGO: {
    title: 'Phiên đã bị kết thúc',
    severity: SEVERITY.WARNING,
    messageTemplates: {
      default: 'Phiên đăng nhập của bạn đã bị kết thúc.',
      byAdmin: 'Tài khoản của bạn đã bị đăng xuất bởi quản trị viên.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  PASSWORD_CHANGED: {
    title: 'Mật khẩu đã thay đổi',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: 'Mật khẩu của bạn đã được thay đổi thành công.',
      byAdmin: 'Quản trị viên đã đặt lại mật khẩu cho tài khoản của bạn.',
    },
    affectsSettings: [IN_APP_PASSWORD_CHANGE],
  },
  ROLE_CHANGED: {
    title: 'Phân quyền đã thay đổi',
    severity: SEVERITY.WARNING,
    messageTemplates: {
      assigned: 'Bạn đã được gán quyền mới: {roles}.',
      revoked: 'Quyền sau đã bị thu hồi: {roles}.',
    },
    affectsSettings: [EMAIL_ON_ROLE_CHANGE, IN_APP_SYSTEM_ALERT],
  },

  // --- CRUD activity events (NEW) ---
  // User management
  USER_CREATED: {
    title: 'Người dùng mới được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo người dùng mới: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  USER_UPDATED: {
    title: 'Người dùng được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật thông tin người dùng: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  USER_DISABLED: {
    title: 'Người dùng bị vô hiệu hóa',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: '{actorName} đã vô hiệu hóa tài khoản: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  USER_ENABLED: {
    title: 'Người dùng được kích hoạt',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã kích hoạt tài khoản: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  USER_PASSWORD_RESET: {
    title: 'Mật khẩu người dùng được đặt lại',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã đặt lại mật khẩu cho: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_PASSWORD_CHANGE],
  },

  // Repair Orders
  REPAIR_ORDER_CREATED: {
    title: 'Phiếu sửa chữa mới được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo phiếu sửa chữa: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  REPAIR_ORDER_UPDATED: {
    title: 'Phiếu sửa chữa được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật phiếu sửa chữa: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  // Repair Settlements
  SETTLEMENT_CREATED: {
    title: 'Phiếu quyết toán mới được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo phiếu quyết toán: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  SETTLEMENT_UPDATED: {
    title: 'Phiếu quyết toán được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật phiếu quyết toán: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  // Inventory
  PERMISSION_REQUEST: {
    title: 'Yêu cầu cấp quyền mới',
    severity: SEVERITY.WARNING,
    messageTemplates: {
      default: '{actorName} ({targetCode}) yêu cầu cấp quyền: {permissionKey}{reason}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  IMPORT_REQUEST_APPROVED: {
    title: 'Phiếu nhập kho được duyệt',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã duyệt phiếu nhập kho: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  IMPORT_REQUEST_REJECTED: {
    title: 'Phiếu nhập kho bị từ chối',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: '{actorName} đã từ chối phiếu nhập kho: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  // Branch management
  BRANCH_CREATED: {
    title: 'Chi nhánh mới được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo chi nhánh mới: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  BRANCH_UPDATED: {
    title: 'Chi nhánh được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật chi nhánh: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  BRANCH_DEACTIVATED: {
    title: 'Chi nhánh bị ngừng hoạt động',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: '{actorName} đã ngừng hoạt động chi nhánh: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  BRANCH_REACTIVATED: {
    title: 'Chi nhánh được kích hoạt lại',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã kích hoạt lại chi nhánh: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  // Role management
  ROLE_CREATED: {
    title: 'Vai trò mới được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo vai trò: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  ROLE_UPDATED: {
    title: 'Vai trò được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật vai trò: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  ROLE_DELETED: {
    title: 'Vai trò bị xóa',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: '{actorName} đã xóa vai trò: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  ROLE_ENABLED: {
    title: 'Vai trò được kích hoạt',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã kích hoạt vai trò: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  // Products
  PRODUCT_CREATED: {
    title: 'Sản phẩm mới được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo sản phẩm: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  PRODUCT_UPDATED: {
    title: 'Sản phẩm được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật sản phẩm: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  PRODUCT_DELETED: {
    title: 'Sản phẩm bị xóa',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: '{actorName} đã xóa sản phẩm: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  EXPORT_REQUEST_CREATED: {
    title: 'Phiếu xuất kho được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo phiếu xuất kho: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  IMPORT_REQUEST_APPROVED: {
    title: 'Phiếu nhập kho được duyệt',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã duyệt phiếu nhập kho: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  IMPORT_REQUEST_REJECTED: {
    title: 'Phiếu nhập kho bị từ chối',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: '{actorName} đã từ chối phiếu nhập kho: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  CUSTOMER_UPDATED: {
    title: 'Khách hàng được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật khách hàng: {targetName} ({targetCode}).',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  BRANCH_MANAGER_CREATED: {
    title: 'Giám đốc chi nhánh được thêm',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã thêm giám đốc chi nhánh: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  BRANCH_MANAGER_UPDATED: {
    title: 'Giám đốc chi nhánh được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật giám đốc chi nhánh: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  VEHICLE_OWNERSHIP_TRANSFERRED: {
    title: 'Quyền sở hữu xe được chuyển',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã chuyển quyền sở hữu xe: {targetName} cho khách hàng mới.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },

  // Specialty management
  SPECIALTY_CREATED: {
    title: 'Chuyên môn mới được tạo',
    severity: SEVERITY.SUCCESS,
    messageTemplates: {
      default: '{actorName} đã tạo chuyên môn: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  SPECIALTY_UPDATED: {
    title: 'Chuyên môn được cập nhật',
    severity: SEVERITY.INFO,
    messageTemplates: {
      default: '{actorName} đã cập nhật chuyên môn: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
  SPECIALTY_DELETED: {
    title: 'Chuyên môn bị xóa',
    severity: SEVERITY.ERROR,
    messageTemplates: {
      default: '{actorName} đã xóa chuyên môn: {targetName}.',
    },
    affectsSettings: [IN_APP_SYSTEM_ALERT],
  },
};

class NotificationService {
  constructor() {
    this.settingsRepo = new NotificationSettingsRepository();
    this.notificationRepo = new NotificationRepository();
  }

  /**
   * Lấy notification settings của user
   */
  async getSettings(userId) {
    return this.settingsRepo.findByUserId(userId);
  }

  /**
   * Cập nhật notification settings
   */
  async updateSettings(userId, settings) {
    return this.settingsRepo.upsert(userId, settings);
  }

  /**
   * Gửi notification
   * @param {string} eventType - Loại event (LOGIN_SUCCESS, ROLE_CHANGED, etc.)
   * @param {object} data - Dữ liệu đi kèm
   * @param {object} options
   * @param {boolean} options.skipSettings - Bypass notification settings (dùng cho notifyAdmins)
   */
  async notify(eventType, data, { skipSettings = false } = {}) {
    const event = NOTIFICATION_EVENTS[eventType];
    if (!event) {
      console.warn(`[NotificationService] Unknown event type: ${eventType}`);
      return null;
    }

    const userId = data.userId;
    if (!userId) {
      console.warn('[NotificationService] No userId provided');
      return null;
    }

    // Lấy settings để kiểm tra (bypass cho notifyAdmins)
    let shouldNotify = skipSettings;
    if (!skipSettings) {
      const settings = await this.settingsRepo.findByUserId(userId);
      shouldNotify = event.affectsSettings.some(setting => {
        if (!settings || typeof settings[setting] !== 'boolean') {
          return false;
        }
        return settings[setting];
      });
    }

    if (!shouldNotify) {
      console.log(`[NotificationService] Notification disabled for ${eventType} for user ${userId}`);
      return null;
    }

    // Tạo title và message
    const title = event.title;
    let message = event.messageTemplates.default;

    // Replace placeholders in message
    if (data.device) message = message.replace('{device}', data.device);
    if (data.location) message = message.replace('{location}', data.location);
    if (data.count) message = message.replace('{count}', data.count);
    if (data.roles) message = message.replace('{roles}', data.roles);
    // CRUD placeholders
    if (data.actorName) message = message.replace('{actorName}', data.actorName);
    if (data.targetName) message = message.replace('{targetName}', data.targetName);
    if (data.targetCode) message = message.replace('{targetCode}', data.targetCode);
    if (data.permissionKey) message = message.replace('{permissionKey}', data.permissionKey);
    if (data.reason) message = message.replace('{reason}', data.reason);

    // Handle different message templates based on data
    if (eventType === 'PASSWORD_CHANGED' && data.resetByAdmin) {
      message = event.messageTemplates.byAdmin;
    }
    if (eventType === 'ROLE_CHANGED' && data.action === 'REVOKED') {
      message = event.messageTemplates.revoked;
    }
    if (eventType === 'ROLE_CHANGED' && data.action === 'ASSIGNED') {
      message = event.messageTemplates.assigned;
    }
    if (eventType === 'FORCE_LOGO' && data.forcedBy) {
      message = event.messageTemplates.byAdmin;
    }
    if (eventType === 'LOGIN_SUCCESS' && data.isNewDevice) {
      message = event.messageTemplates.withDevice.replace('{device}', data.device || 'thiết bị mới');
    }

    // Build metadata
    const metadata = {
      eventType,
      ip: data.ipAddress || data.ip,
      browser: data.browser,
      os: data.os,
      deviceId: data.deviceId,
      timestamp: new Date().toISOString(),
    };

    // Add extra metadata based on event type
    if (data.action) metadata.action = data.action;
    if (data.resetByAdmin) metadata.resetByAdmin = true;
    if (data.forcedBy) metadata.forcedBy = data.forcedBy;
    if (data.changedBy) metadata.changedBy = data.changedBy;
    if (data.actorName) metadata.actorName = data.actorName;
    if (data.targetName) metadata.targetName = data.targetName;
    if (data.targetCode) metadata.targetCode = data.targetCode;

    // Create notification in DB
    const notification = await this.notificationRepo.create({
      userId,
      title: event.title,
      message,
      type: eventType,
      severity: event.severity || null,
      metadata,
    });

    // Emit SSE event for real-time update
    this._emitSSEEvent(userId, notification);

    return notification;
  }

  /**
   * Gửi notification tới TẤT CẢ admin đang hoạt động.
   * Dùng cho các sự kiện CRUD — mọi admin đều nhận được thông báo.
   *
   * @param {string} eventType - Loại event (USER_CREATED, REPAIR_ORDER_CREATED, ...)
   * @param {object} data - Dữ liệu đi kèm
   * @param {object} options
   * @param {number|null} options.excludeUserId - Loại trừ user ID nào (vd: người thực hiện)
   */
  async notifyAdmins(eventType, data, { excludeUserId = null } = {}) {
    const adminsResult = await query(`
      SELECT u.id
      FROM users u
      JOIN user_role ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.role_name = 'admin'
        AND u.status = 'active'
        AND EXISTS (
          SELECT 1 FROM login_sessions ls
          WHERE ls.user_id = u.id
            AND ls.status = 'active'
            AND ls.action_type = 'LOGIN'
        )
    `);

    const adminIds = adminsResult.recordset
      .map((r) => r.id)
      .filter((id) => id !== excludeUserId);

    const results = [];
    for (const adminId of adminIds) {
      try {
        // skipSettings: true -> luôn gửi notification cho admin, không bị settings block
        const result = await this.notify(eventType, { ...data, userId: adminId }, { skipSettings: true });
        results.push({ adminId, notification: result });
      } catch (err) {
        console.warn(`[NotificationService] Failed to notify admin ${adminId}:`, err.message);
      }
    }
    return results;
  }

  /**
   * Lấy notifications của user
   */
  async getNotifications(userId, options = {}) {
    return this.notificationRepo.findByUserId(userId, options);
  }

  /**
   * Đánh dấu notification đã đọc
   */
  async markAsRead(notificationId, userId) {
    return this.notificationRepo.markAsRead(notificationId, userId);
  }

  /**
   * Đánh dấu tất cả notifications đã đọc
   */
  async markAllAsRead(userId) {
    return this.notificationRepo.markAllAsRead(userId);
  }

  /**
   * Đếm notification chưa đọc
   */
  async getUnreadCount(userId) {
    return this.notificationRepo.getUnreadCount(userId);
  }

  /**
   * Emit SSE event cho user
   */
  _emitSSEEvent(userId, notification) {
    try {
      const NotificationEvents = require('../events/NotificationEvents');
      NotificationEvents.emitNotification(userId, notification);
    } catch (err) {
      console.error('[NotificationService] Failed to emit SSE event:', err.message);
    }
  }
}

module.exports = NotificationService;
