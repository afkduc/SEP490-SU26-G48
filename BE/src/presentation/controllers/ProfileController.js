const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');
const ProfileBranchService = require('../../application/services/ProfileBranchService');

class ProfileController {
  constructor(profileService) {
    this.profileService = profileService;
    this.branchService = new ProfileBranchService();
    this.notificationService = new NotificationService();
    this.getMyProfile = this.getMyProfile.bind(this);
    this.updateMyProfile = this.updateMyProfile.bind(this);
    this.getNotificationSettings = this.getNotificationSettings.bind(this);
    this.updateNotificationSettings = this.updateNotificationSettings.bind(this);
    this.getNotifications = this.getNotifications.bind(this);
    this.markNotificationRead = this.markNotificationRead.bind(this);
    this.markAllNotificationsRead = this.markAllNotificationsRead.bind(this);
    this.getUnreadCount = this.getUnreadCount.bind(this);
    this.logoutAllMyDevices = this.logoutAllMyDevices.bind(this);
  }

  /**
   * Lay profile cua chinh user dang dang nhap, gom ca
   * assignedBranches (do ProfileBranchService xu ly rieng).
   *
   * Truoc day: ProfileRepositoryImpl.findById tu LEFT JOIN branches +
   * assignedBranches (ProfileBranchService — users.branch_id).
   * Sau nay: Repository chi tra row user, Controller goi them
   * branchService.getProfileBranches() de lay primary + assigned.
   */
  async getMyProfile(req, res, next) {
    try {
      const profile = await this.profileService.getProfile(req.user.userId);
      const branchInfo = await this.branchService.getProfileBranches(req.user.userId);

      // Merge branch info vao profile. Cac field nay co the da duoc
      // repository set default (null/[]), override o day.
      profile.branchId = branchInfo.branchId ?? profile.branchId ?? null;
      profile.branchName = branchInfo.branchName ?? profile.branchName ?? null;
      profile.assignedBranches = branchInfo.assignedBranches || [];

      return success(res, profile, 'Lấy thông tin thành công');
    } catch (err) {
      next(err);
    }
  }

  async updateMyProfile(req, res, next) {
    try {
      const profile = await this.profileService.updateProfile(req.user.userId, req.body);

      // Sau update, lay lai branches de FE sync storage/AppContext
      // voi danh sach day du (neu role admin doi branch_id cua chinh minh).
      const branchInfo = await this.branchService.getProfileBranches(req.user.userId);
      profile.branchId = branchInfo.branchId ?? profile.branchId ?? null;
      profile.branchName = branchInfo.branchName ?? profile.branchName ?? null;
      profile.assignedBranches = branchInfo.assignedBranches || [];

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

  // POST /profile/me/devices/logout-all — đăng xuất mọi thiết bị của chính mình
  async logoutAllMyDevices(req, res, next) {
    try {
      const DeviceService = require('../../application/services/DeviceService');
      const result = await new DeviceService().forceLogoutAllDevices(req.user.userId);
      return success(
        res,
        result,
        result?.revoked > 0
          ? 'Đã đăng xuất mọi thiết bị. Vui lòng đăng nhập lại.'
          : (result?.message || 'Không có thiết bị nào đang hoạt động')
      );
    } catch (err) {
      next(err);
    }
  }

}

module.exports = ProfileController;
