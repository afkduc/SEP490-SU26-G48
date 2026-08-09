const ApiError = require('../../utils/ApiError');
const {
  EMAIL_HINT,
  EMAIL_MAX_LENGTH,
  isValidEmail,
  isValidPhone,
  getPersonNameError,
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

    if (firstName !== undefined && firstName !== null) {
      const firstNameErr = getPersonNameError(firstName, { required: false, label: 'Họ' });
      if (firstNameErr) throw new ApiError(400, firstNameErr);
    }
    if (lastName !== undefined && lastName !== null) {
      const lastNameErr = getPersonNameError(lastName, { required: false, label: 'Tên' });
      if (lastNameErr) throw new ApiError(400, lastNameErr);
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateUpdateProfile };
