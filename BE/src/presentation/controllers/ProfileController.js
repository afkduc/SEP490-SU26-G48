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
    this.changePassword = this.changePassword.bind(this);
    this.getNotificationSettings = this.getNotificationSettings.bind(this);
    this.updateNotificationSettings = this.updateNotificationSettings.bind(this);
    this.getNotifications = this.getNotifications.bind(this);
    this.markNotificationRead = this.markNotificationRead.bind(this);
    this.markAllNotificationsRead = this.markAllNotificationsRead.bind(this);
    this.getUnreadCount = this.getUnreadCount.bind(this);
    this.requestPermission = this.requestPermission.bind(this);
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

  /**
   * POST /profile/me/request-permission
   * User gửi yêu cầu cấp quyền cho admin.
   * Gửi notification tới tất cả admin đang online.
   */
  async requestPermission(req, res, next) {
    try {
      const { permissionKey, reason, page } = req.body;
      if (!permissionKey) {
        return res.status(400).json({ success: false, message: 'permissionKey là bắt buộc' });
      }

      // Lấy thông tin user hiện tại
      const { query } = require('../../infrastructure/database/sqlServer');
      const userResult = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.user_name,
                r.role_name, r.role_label
         FROM users u
         LEFT JOIN user_role ur ON ur.user_id = u.id AND ISNULL(ur.is_active, 1) = 1
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = @p1`,
        { p1: req.user.userId }
      );
      const user = userResult.recordset[0];
      const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.user_name || user.email;

      // Gửi notification tới tất cả admin
      await this.notificationService.notifyAdmins('PERMISSION_REQUEST', {
        actorName: userName,
        targetCode: user.email,
        reason: reason || null,
        permissionKey,
        page: page || null,
        // Metadata đặc biệt để admin có thể quick-assign
        quickAssignPermission: permissionKey,
        requesterId: req.user.userId,
      }, { excludeUserId: req.user.userId });

      // Ghi audit log yêu cầu cấp quyền
      try {
        await auditCrud.create(req, {
          tableName: 'notifications',
          entityName: 'Yêu cầu cấp quyền',
          entityCode: permissionKey,
          recordId: req.user.userId,
          newData: { permissionKey, reason: reason || null, page: page || null },
          description: `${userName} yêu cầu cấp quyền ${permissionKey}`,
        });
      } catch (auditErr) {
        console.warn('[ProfileController] requestPermission audit failed:', auditErr.message);
      }

      return success(res, null, 'Đã gửi yêu cầu cấp quyền tới quản trị viên');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProfileController;
