const ApiError = require('../../utils/ApiError');
const {
  BRANCH_CODE_MAX,
  NAME_MAX_LENGTH,
  EMAIL_HINT,
  isValidEmail,
  isValidPhone,
} = require('../../utils/fieldValidation');

function validateCreateBranch(req, res, next) {
  try {
    const { branchCode, branchName, phone, email } = req.body || {};

    if (!branchCode || !String(branchCode).trim()) {
      throw new ApiError(400, 'branchCode là bắt buộc');
    }
    if (String(branchCode).trim().length > BRANCH_CODE_MAX) {
      throw new ApiError(400, `branchCode tối đa ${BRANCH_CODE_MAX} ký tự`);
    }
    if (!branchName || !String(branchName).trim()) {
      throw new ApiError(400, 'branchName là bắt buộc');
    }
    if (String(branchName).trim().length > NAME_MAX_LENGTH) {
      throw new ApiError(400, `branchName tối đa ${NAME_MAX_LENGTH} ký tự`);
    }
    if (phone !== undefined && phone !== null && String(phone).trim()) {
      if (!isValidPhone(phone)) {
        throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, 10–11 chữ số');
      }
    }
    if (email !== undefined && email !== null && String(email).trim()) {
      if (!isValidEmail(email)) {
        throw new ApiError(400, EMAIL_HINT);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function validateUpdateBranch(req, res, next) {
  try {
    const { branchName, phone, email } = req.body || {};
    if (branchName !== undefined) {
      if (!String(branchName).trim()) {
        throw new ApiError(400, 'branchName không được rỗng');
      }
      if (String(branchName).trim().length > NAME_MAX_LENGTH) {
        throw new ApiError(400, `branchName tối đa ${NAME_MAX_LENGTH} ký tự`);
      }
    }
    if (phone !== undefined && phone !== null && String(phone).trim()) {
      if (!isValidPhone(phone)) {
        throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, 10–11 chữ số');
      }
    }
    if (email !== undefined && email !== null && String(email).trim()) {
      if (!isValidEmail(email)) {
        throw new ApiError(400, EMAIL_HINT);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateCreateBranch, validateUpdateBranch };
