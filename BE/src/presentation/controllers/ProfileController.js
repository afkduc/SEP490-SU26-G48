const { success } = require('../../utils/response');

class ProfileController {
  constructor(profileService) {
    this.profileService = profileService;
    this.getMyProfile = this.getMyProfile.bind(this);
    this.updateMyProfile = this.updateMyProfile.bind(this);
    this.changePassword = this.changePassword.bind(this);
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
      return success(res, profile, 'Cập nhật thông tin thành công');
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      await this.profileService.changePassword(req.user.userId, currentPassword, newPassword);
      return success(res, null, 'Đổi mật khẩu thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProfileController;
