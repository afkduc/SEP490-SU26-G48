const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0[0-9]{9,10})$/;

class ProfileService {
  constructor(profileRepository) {
    this.profileRepository = profileRepository;
  }

  async getProfile(userId) {
    const profile = await this.profileRepository.findById(userId);
    if (!profile) {
      throw new ApiError(404, 'Không tìm thấy thông tin người dùng');
    }
    return profile;
  }

  async updateProfile(userId, payload) {
    const errors = [];

    if (payload.email !== undefined && payload.email !== null && payload.email !== '') {
      if (!EMAIL_REGEX.test(payload.email)) {
        errors.push('Email không đúng định dạng');
      }
      const existing = await this.profileRepository.findByEmail(payload.email);
      if (existing && Number(existing.id) !== Number(userId)) {
        errors.push('Email đã được sử dụng bởi người khác');
      }
    }

    if (payload.phone !== undefined && payload.phone !== null && payload.phone !== '') {
      if (!PHONE_REGEX.test(payload.phone)) {
        errors.push('Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số');
      }
    }

    if (errors.length > 0) {
      throw new ApiError(400, errors.join('; '));
    }

    const updated = await this.profileRepository.update(userId, {
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
    });

    if (!updated) {
      throw new ApiError(404, 'Không tìm thấy người dùng');
    }

    return updated;
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new ApiError(400, 'Mật khẩu hiện tại và mật khẩu mới không được để trống');
    }

    if (newPassword.length < 6) {
      throw new ApiError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const user = await this.profileRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new ApiError(404, 'Không tìm thấy người dùng');
    }

    const isMatch = await this._verifyPassword(currentPassword, user.user_password);
    if (!isMatch) {
      throw new ApiError(401, 'Mật khẩu hiện tại không đúng');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.profileRepository.updatePassword(userId, passwordHash);

    return true;
  }

  async _verifyPassword(input, stored) {
    if (stored && stored.startsWith('$2b$')) {
      return bcrypt.compare(input, stored);
    }
    return input === stored;
  }
}

module.exports = ProfileService;
