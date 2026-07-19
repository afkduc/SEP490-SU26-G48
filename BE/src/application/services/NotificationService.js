const NotificationSettingsRepository = require('../../infrastructure/repositories/NotificationSettingsRepository');
const NotificationRepository = require('../../infrastructure/repositories/NotificationRepository');

const NOTIFICATION_EVENTS = {
  LOGIN_SUCCESS: {
    title: 'Đăng nhập thành công',
    messageTemplates: {
      default: 'Bạn đã đăng nhập vào hệ thống.',
      withDevice: 'Bạn đã đăng nhập từ thiết bị mới: {device}.',
    },
    affectsSettings: ['inAppLogin'],
  },
  LOGIN_FAILED: {
    title: 'Cảnh báo đăng nhập',
    messageTemplates: {
      default: 'Có {count} lần đăng nhập thất bại cho tài khoản của bạn.',
    },
    affectsSettings: ['inAppSecurityAlert'],
  },
  NEW_DEVICE: {
    title: 'Đăng nhập từ thiết bị mới',
    messageTemplates: {
      default: 'Phát hiện đăng nhập từ thiết bị mới: {device} từ {location}.',
    },
    affectsSettings: ['inAppSecurityAlert'],
  },
  FORCE_LOGOUT: {
    title: 'Phiên đã bị kết thúc',
    messageTemplates: {
      default: 'Phiên đăng nhập của bạn đã bị kết thúc.',
      byAdmin: 'Tài khoản của bạn đã bị đăng xuất bởi quản trị viên.',
    },
    affectsSettings: ['inAppSecurityAlert'],
  },
  PASSWORD_CHANGED: {
    title: 'Mật khẩu đã thay đổi',
    messageTemplates: {
      default: 'Mật khẩu của bạn đã được thay đổi thành công.',
      byAdmin: 'Quản trị viên đã đặt lại mật khẩu cho tài khoản của bạn.',
    },
    affectsSettings: ['inAppPasswordChange'],
  },
  ROLE_CHANGED: {
    title: 'Phân quyền đã thay đổi',
    messageTemplates: {
      assigned: 'Bạn đã được gán quyền mới: {roles}.',
      revoked: 'Quyền sau đã bị thu hồi: {roles}.',
    },
    affectsSettings: ['inAppRoleChange'],
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
   */
  async notify(eventType, data) {
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

    // Lấy settings để kiểm tra
    const settings = await this.settingsRepo.findByUserId(userId);

    // Kiểm tra setting tương ứng
    const shouldNotify = event.affectsSettings.some(setting => {
      return settings[setting];
    });

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
    if (eventType === 'FORCE_LOGOUT' && data.forcedBy) {
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

    // Create notification in DB
    const notification = await this.notificationRepo.create({
      userId,
      title,
      message,
      type: eventType,
      metadata,
    });

    // Emit SSE event for real-time update
    this._emitSSEEvent(userId, notification);

    return notification;
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
      const NotificationEvents = require('./NotificationEvents');
      NotificationEvents.emitNotification(userId, notification);
    } catch (err) {
      console.error('[NotificationService] Failed to emit SSE event:', err.message);
    }
  }
}

module.exports = NotificationService;
