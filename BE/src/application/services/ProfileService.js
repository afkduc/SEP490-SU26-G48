const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');
const {
  EMAIL_HINT,
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  isValidPhone,
  isValidPassword,
} = require('../../utils/fieldValidation');

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

    if (payload.email !== undefined && payload.email !== null) {
      const email = String(payload.email).trim();
      if (!email) {
        errors.push('Email là bắt buộc');
      } else if (email.length > EMAIL_MAX_LENGTH || !isValidEmail(email)) {
        errors.push(EMAIL_HINT);
      } else {
        const existing = await this.profileRepository.findByEmail(email);
        if (existing && Number(existing.id) !== Number(userId)) {
          errors.push('Email đã được sử dụng bởi người khác');
        }
        payload.email = email;
      }
    }

    if (payload.phone !== undefined && payload.phone !== null) {
      const phone = String(payload.phone).trim();
      if (!phone) {
        errors.push('Số điện thoại là bắt buộc');
      } else if (!isValidPhone(phone)) {
        errors.push('Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số');
      } else {
        const phoneOwner = await this.profileRepository.findByPhone(phone);
        if (phoneOwner && Number(phoneOwner.id) !== Number(userId)) {
          errors.push('Số điện thoại đã được sử dụng bởi người khác');
        }
        payload.phone = phone;
      }
    }

    if (payload.firstName !== undefined && payload.firstName !== null) {
      const firstName = String(payload.firstName).trim();
      if (firstName.length > NAME_MAX_LENGTH) {
        errors.push(`Họ tối đa ${NAME_MAX_LENGTH} ký tự`);
      } else {
        payload.firstName = firstName;
      }
    }

    if (payload.lastName !== undefined && payload.lastName !== null) {
      const lastName = String(payload.lastName).trim();
      if (lastName.length > NAME_MAX_LENGTH) {
        errors.push(`Tên tối đa ${NAME_MAX_LENGTH} ký tự`);
      } else {
        payload.lastName = lastName;
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

    if (!isValidPassword(newPassword)) {
      throw new ApiError(400, `Mật khẩu mới tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`);
    }

    const user = await this.profileRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new ApiError(404, 'Không tìm thấy người dùng');
    }

    const isMatch = await this._verifyPassword(currentPassword, user.user_password);
    if (!isMatch) {
      // 400 (không 401): sai mật khẩu hiện tại ≠ hết phiên JWT.
      // FE coi 401 là session expired → đá user ra login.
      throw new ApiError(400, 'Mật khẩu hiện tại không đúng');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.profileRepository.updatePassword(userId, passwordHash);

    // Notify user about password change
    this._sendPasswordChangedNotification(userId);

    return true;
  }

  async _sendPasswordChangedNotification(userId) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      await ns.notify('PASSWORD_CHANGED', { userId });
    } catch (err) {
      console.error('[ProfileService] Failed to send password changed notification:', err.message);
    }
  }

  async _verifyPassword(input, stored) {
    if (stored && stored.startsWith('$2b$')) {
      return bcrypt.compare(input, stored);
    }
    return input === stored;
  }
}

module.exports = ProfileService;
