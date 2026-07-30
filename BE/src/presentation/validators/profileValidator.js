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

function validateUpdateProfile(req, res, next) {
  try {
    const { email, phone, firstName, lastName } = req.body || {};

    if (email !== undefined && email !== null) {
      if (!String(email).trim()) throw new ApiError(400, 'Email là bắt buộc');
      if (String(email).trim().length > EMAIL_MAX_LENGTH || !isValidEmail(email)) {
        throw new ApiError(400, EMAIL_HINT);
      }
    }

    if (phone !== undefined && phone !== null) {
      if (!String(phone).trim()) throw new ApiError(400, 'Số điện thoại là bắt buộc');
      if (!isValidPhone(phone)) {
        throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, 10–11 chữ số');
      }
    }

    if (firstName !== undefined && firstName !== null && String(firstName).trim().length > NAME_MAX_LENGTH) {
      throw new ApiError(400, `Họ tối đa ${NAME_MAX_LENGTH} ký tự`);
    }
    if (lastName !== undefined && lastName !== null && String(lastName).trim().length > NAME_MAX_LENGTH) {
      throw new ApiError(400, `Tên tối đa ${NAME_MAX_LENGTH} ký tự`);
    }

    next();
  } catch (err) {
    next(err);
  }
}

function validateChangePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      throw new ApiError(400, 'Mật khẩu hiện tại và mật khẩu mới không được để trống');
    }
    if (!isValidPassword(newPassword)) {
      throw new ApiError(400, `Mật khẩu mới tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`);
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateUpdateProfile, validateChangePassword };
