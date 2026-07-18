const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { query } = require('../infrastructure/database/sqlServer');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Chưa đăng nhập'));
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new ApiError(401, 'Token không hợp lệ hoặc đã hết hạn'));
  }

  if (!decoded.userId) {
    req.user = decoded;
    return next();
  }

  try {
    const result = await query(
      `SELECT token_version FROM users WHERE id = @userId`,
      { userId: decoded.userId }
    );
    const dbVersion = result.recordset[0]?.token_version;
    if (dbVersion !== undefined && decoded.tokenVersion !== dbVersion) {
      return next(new ApiError(401, 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.'));
    }
    // Merge permissions from JWT (set at login time) into req.user
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      branchId: decoded.branchId,
      tokenVersion: decoded.tokenVersion,
    };
    next();
  } catch {
    req.user = decoded;
    next();
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Chưa đăng nhập'));
    const hasRole = req.user.roles?.some((r) => roles.includes(r));
    if (!hasRole) return next(new ApiError(403, 'Không có quyền truy cập'));
    next();
  };
}

const requireAdmin = authorize('admin');

module.exports = { authenticate, authorize, requireAdmin };
