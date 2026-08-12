const ApiError = require('../../utils/ApiError');
const {
  EMAIL_HINT,
  EMAIL_MAX_LENGTH,
  isValidEmail,
  isValidPhone,
  getPersonNameError,
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
      const firstName = String(payload.firstName).trim().replace(/\s+/g, ' ');
      const firstNameErr = getPersonNameError(firstName, { required: false, label: 'Họ' });
      if (firstNameErr) errors.push(firstNameErr);
      else payload.firstName = firstName;
    }

    if (payload.lastName !== undefined && payload.lastName !== null) {
      const lastName = String(payload.lastName).trim().replace(/\s+/g, ' ');
      const lastNameErr = getPersonNameError(lastName, { required: false, label: 'Tên' });
      if (lastNameErr) errors.push(lastNameErr);
      else payload.lastName = lastName;
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

  async changePassword(_userId, _currentPassword, _newPassword) {
    // Không cho tự đổi MK bằng mật khẩu cũ: ai đã biết pass cũ sẽ chiếm được tài khoản.
    // Đặt lại chỉ qua quên mật khẩu (email OTP) hoặc admin reset.
    throw new ApiError(
      403,
      'Không hỗ trợ đổi mật khẩu trong hồ sơ. Vui lòng dùng Quên mật khẩu (email) hoặc liên hệ quản trị viên.'
    );
  }
}

module.exports = ProfileService;
