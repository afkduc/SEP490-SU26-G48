const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');
const ProfileBranchService = require('../../application/services/ProfileBranchService');
const ApiError = require('../../utils/ApiError');
const fs = require('fs');
const path = require('path');

class ProfileController {
  constructor(profileService) {
    this.profileService = profileService;
    this.branchService = new ProfileBranchService();
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
    this.getMyAvatar = this.getMyAvatar.bind(this);
  }

  /**
   * Lay profile cua chinh user dang dang nhap, gom ca
   * assignedBranches (do ProfileBranchService xu ly rieng).
   *
   * Truoc day: ProfileRepositoryImpl.findById tu LEFT JOIN branches +
   * query user_branches. Loi: repository biet qua nhieu thu, kho test.
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

  // GET /profile/me/avatar - stream ảnh avatar hiện tại của user
  async getMyAvatar(req, res, next) {
    try {
      const profile = await this.profileService.getProfile(req.user.userId);
      const avatar = profile?.avatar;
      if (!avatar) {
        throw new ApiError(404, 'Avatar chưa được thiết lập');
      }

      // Lấy basename để tránh path traversal.
      const fileName = path.basename(String(avatar));
      const avatarDir = path.join(__dirname, '..', '..', '..', 'avatar');
      const filePath = path.join(avatarDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new ApiError(404, 'Avatar không tồn tại');
      }

      return res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }

}

module.exports = ProfileController;
