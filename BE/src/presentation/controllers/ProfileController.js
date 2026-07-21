const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class ProfileController {
  constructor(profileService) {
    this.profileService = profileService;
    this.notificationService = new NotificationService();
    this.getMyProfile = this.getMyProfile.bind(this);
    this.updateMyProfile = this.updateMyProfile.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.getNotificationSettings = this.getNotificationSettings.bind(this);
    this.updateNotificationSettings = this.updateNotificationSettings.bind(this);
    this.getNotifications = this.getNotifications.bind(this);
    this.markNotificationRead = this.markNotificationRead.bind(this);
    this.markAllNotificationsRead = this.markAllNotificationsRead.bind(this);
    this.getUnreadCount = this.getUnreadCount.bind(this);
  }

  async getMyProfile(req, res, next) {
    try {
      const profile = await this.profileService.getProfile(req.user.userId);
      return success(res, profile, 'Lấy thông tin thành công');
    } catch (err) {
      next(err);
    }
  }

  async updateMyProfile(req, res, next) {
    try {
      const profile = await this.profileService.updateProfile(req.user.userId, req.body);
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: req.user.email || `ID-${req.user.userId}`,
        recordId: req.user.userId,
        entityName: 'Hồ sơ cá nhân',
        newData: req.body,
        description: `Cập nhật hồ sơ cá nhân`,
      });
      return success(res, profile, 'Cập nhật thông tin thành công');
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      await this.profileService.changePassword(req.user.userId, currentPassword, newPassword);
      await auditCrud.changePassword(req, {
        targetUserName: req.user.email || `ID-${req.user.userId}`,
      });
      return success(res, null, 'Đổi mật khẩu thành công');
    } catch (err) {
      next(err);
    }
  }

  async getNotificationSettings(req, res, next) {
    try {
      const settings = await this.notificationService.getSettings(req.user.userId);
      return success(res, settings, 'Lấy cài đặt thông báo thành công');
    } catch (err) {
      next(err);
    }
  }

  async updateNotificationSettings(req, res, next) {
    try {
      const settings = await this.notificationService.updateSettings(req.user.userId, req.body);
      return success(res, settings, 'Cập nhật cài đặt thông báo thành công');
    } catch (err) {
      next(err);
    }
  }

  async getNotifications(req, res, next) {
    try {
      const { page = 1, pageSize = 20, unreadOnly } = req.query;
      const result = await this.notificationService.getNotifications(req.user.userId, {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        unreadOnly: unreadOnly === 'true',
      });
      return success(res, result, 'Lấy danh sách thông báo thành công');
    } catch (err) {
      next(err);
    }
  }

  async markNotificationRead(req, res, next) {
    try {
      const notification = await this.notificationService.markAsRead(
        parseInt(req.params.id, 10),
        req.user.userId
      );
      return success(res, notification, 'Đánh dấu đã đọc thành công');
    } catch (err) {
      next(err);
    }
  }

  async markAllNotificationsRead(req, res, next) {
    try {
      await this.notificationService.markAllAsRead(req.user.userId);
      return success(res, null, 'Đánh dấu tất cả đã đọc thành công');
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const count = await this.notificationService.getUnreadCount(req.user.userId);
      return success(res, { count }, 'Lấy số thông báo chưa đọc thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProfileController;
