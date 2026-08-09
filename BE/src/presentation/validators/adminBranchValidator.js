const ApiError = require('../../utils/ApiError');
const {
  BRANCH_CODE_MAX,
  EMAIL_HINT,
  isValidEmail,
  isValidPhone,
  getBranchNameError,
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
    const branchNameErr = getBranchNameError(branchName, { required: true });
    if (branchNameErr) throw new ApiError(400, branchNameErr);
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
      const branchNameErr = getBranchNameError(branchName, { required: true });
      if (branchNameErr) throw new ApiError(400, branchNameErr);
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
