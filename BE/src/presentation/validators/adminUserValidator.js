const ApiError = require('../../utils/ApiError');
const {
  EMAIL_HINT,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  getUsernameError,
  getPersonNameError,
} = require('../../utils/fieldValidation');

const VALID_STATUSES = ['active', 'inactive'];

/**
 * Validate query params cho GET /api/admin/users
 */
function validateListUsersQuery(req, res, next) {
  try {
    const { search, branchId, roleId, status, page, pageSize } = req.query;

    if (search !== undefined && (typeof search !== 'string' || search.length > 100)) {
      throw new ApiError(400, 'search phải là chuỗi (tối đa 100 ký tự)');
    }

    if (branchId !== undefined) {
      const parsed = Number(branchId);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ApiError(400, 'branchId phải là số nguyên dương');
      }
    }

    if (roleId !== undefined && (typeof roleId !== 'string' || roleId.length > 50)) {
      throw new ApiError(400, 'roleId phải là chuỗi (tối đa 50 ký tự)');
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, `status không hợp lệ (chỉ chấp nhận: ${VALID_STATUSES.join(', ')})`);
    }

    if (page !== undefined) {
      const parsed = Number(page);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ApiError(400, 'page phải là số nguyên >= 1');
      }
    }

    if (pageSize !== undefined) {
      const parsed = Number(pageSize);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new ApiError(400, 'pageSize phải là số nguyên từ 1 đến 100');
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

function validateCreateUser(req, res, next) {
  try {
    const { name, email, password, roleId, branchId, scopeAllBranches, firstName, lastName, phone } = req.body || {};

    const usernameErr = getUsernameError(name, { required: true });
    if (usernameErr) throw new ApiError(400, usernameErr);
    if (!email || !String(email).trim()) {
      throw new ApiError(400, 'Email là bắt buộc');
    }
    if (String(email).trim().length > EMAIL_MAX_LENGTH || !isValidEmail(email)) {
      throw new ApiError(400, EMAIL_HINT);
    }
    if (!password) {
      throw new ApiError(400, 'Mật khẩu là bắt buộc');
    }
    if (!isValidPassword(password)) {
      throw new ApiError(400, `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`);
    }
    if (!roleId) {
      throw new ApiError(400, 'roleId là bắt buộc');
    }
    const parsedRole = Number(roleId);
    if (!Number.isInteger(parsedRole) || parsedRole <= 0) {
      throw new ApiError(400, 'roleId phải là số nguyên dương');
    }
    const lastNameErr = getPersonNameError(lastName, { required: true, label: 'Tên' });
    if (lastNameErr) throw new ApiError(400, lastNameErr);
    const firstNameErr = getPersonNameError(firstName, { required: false, label: 'Họ' });
    if (firstNameErr) throw new ApiError(400, firstNameErr);
    if (!phone || !String(phone).trim()) {
      throw new ApiError(400, 'Số điện thoại là bắt buộc');
    }
    if (!isValidPhone(phone)) {
      throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (không tính dấu gạch)');
    }
    if (scopeAllBranches !== true) {
      if (branchId === undefined || branchId === null || branchId === '') {
        throw new ApiError(400, 'branchId là bắt buộc (hoặc chọn "Tất cả chi nhánh")');
      }
      const parsedBranch = Number(branchId);
      if (!Number.isInteger(parsedBranch) || parsedBranch <= 0) {
        throw new ApiError(400, 'branchId phải là số nguyên dương');
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

function validateUpdateUser(req, res, next) {
  try {
    const body = req.body || {};
    const { email, phone, status, roleId, branchId, firstName, lastName, scopeAllBranches } = body;

    if (Object.keys(body).length === 0) {
      throw new ApiError(400, 'Body cập nhật không được rỗng');
    }

    if (email !== undefined && email !== null) {
      if (!String(email).trim()) throw new ApiError(400, 'Email không được rỗng');
      if (String(email).trim().length > EMAIL_MAX_LENGTH || !isValidEmail(email)) {
        throw new ApiError(400, EMAIL_HINT);
      }
    }

    if (phone !== undefined && phone !== null) {
      if (!String(phone).trim()) throw new ApiError(400, 'Số điện thoại là bắt buộc');
      if (!isValidPhone(phone)) {
        throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (không tính dấu gạch)');
      }
    }

    if (status !== undefined && status !== null && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'status không hợp lệ: active, inactive');
    }

    if (lastName !== undefined && lastName !== null) {
      const lastNameErr = getPersonNameError(lastName, { required: true, label: 'Tên' });
      if (lastNameErr) throw new ApiError(400, lastNameErr);
    }

    if (firstName !== undefined && firstName !== null) {
      const firstNameErr = getPersonNameError(firstName, { required: false, label: 'Họ' });
      if (firstNameErr) throw new ApiError(400, firstNameErr);
    }

    if (roleId !== undefined && roleId !== null && roleId !== '') {
      const parsedRole = Number(roleId);
      if (!Number.isInteger(parsedRole) || parsedRole <= 0) {
        throw new ApiError(400, 'roleId phải là số nguyên dương');
      }
    }

    if (scopeAllBranches !== true && branchId !== undefined && branchId !== null && branchId !== '') {
      const parsedBranch = Number(branchId);
      if (!Number.isInteger(parsedBranch) || parsedBranch <= 0) {
        throw new ApiError(400, 'branchId phải là số nguyên dương');
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

function validateResetPassword(req, res, next) {
  try {
    const { newPassword } = req.body || {};
    if (newPassword !== undefined && newPassword !== null && newPassword !== '') {
      if (!isValidPassword(newPassword)) {
        throw new ApiError(400, `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function validateAssignRoles(req, res, next) {
  try {
    const { roleIds } = req.body || {};
    if (roleIds === undefined || roleIds === null) {
      throw new ApiError(400, 'roleIds là bắt buộc');
    }
    const ids = Array.isArray(roleIds) ? roleIds : [roleIds];
    if (ids.length === 0) {
      throw new ApiError(400, 'roleIds không được rỗng');
    }
    for (const id of ids) {
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) {
        throw new ApiError(400, 'Mỗi roleId phải là số nguyên dương');
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  validateListUsersQuery,
  validateCreateUser,
  validateUpdateUser,
  validateResetPassword,
  validateAssignRoles,
};
