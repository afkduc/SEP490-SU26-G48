const ApiError = require('../../utils/ApiError');

function validateCreateRole(req, res, next) {
  try {
    const { roleName, roleLabel } = req.body || {};
    if (!roleName || !String(roleName).trim()) {
      throw new ApiError(400, 'roleName là bắt buộc');
    }
    if (!roleLabel || !String(roleLabel).trim()) {
      throw new ApiError(400, 'roleLabel là bắt buộc');
    }
    const slug = String(roleName).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (slug.length < 2) {
      throw new ApiError(400, 'roleName phải có ít nhất 2 ký tự (chỉ chữ cái và số)');
    }
    next();
  } catch (err) {
    next(err);
  }
}

function validateUpdateRole(req, res, next) {
  try {
    const { roleLabel } = req.body || {};
    if (roleLabel === undefined || roleLabel === null || !String(roleLabel).trim()) {
      throw new ApiError(400, 'roleLabel không được rỗng');
    }
    next();
  } catch (err) {
    next(err);
  }
}

function validateSetPermissions(req, res, next) {
  try {
    const { permissionIds } = req.body || {};
    if (!Array.isArray(permissionIds)) {
      throw new ApiError(400, 'permissionIds phải là mảng');
    }
    for (const id of permissionIds) {
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) {
        throw new ApiError(400, 'Mỗi permissionId phải là số nguyên dương');
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateCreateRole, validateUpdateRole, validateSetPermissions };
