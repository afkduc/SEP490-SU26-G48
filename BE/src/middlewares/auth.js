const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { query } = require('../infrastructure/database/sqlServer');

async function authenticate(req, res, next) {
  // Allow preflight CORS requests to pass through
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
      `SELECT u.token_version, u.status, u.branch_id, b.is_active AS branch_is_active
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id = @userId`,
      { userId: decoded.userId }
    );
    const authRow = result.recordset[0];
    const dbVersion = authRow?.token_version;
    if (dbVersion !== undefined && decoded.tokenVersion !== dbVersion) {
      return next(new ApiError(401, 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.'));
    }

    if (authRow?.status && authRow.status !== 'active') {
      return next(new ApiError(401, 'Tài khoản đã bị khóa. Vui lòng đăng nhập lại sau khi được kích hoạt.'));
    }

    if (authRow?.branch_id && authRow.branch_is_active !== undefined && !Boolean(authRow.branch_is_active)) {
      return next(new ApiError(401, 'Chi nhánh của tài khoản này đang bị ngưng hoạt động.'));
    }

    // Kiem tra device con active khong (per-device logout)
    // Neu co deviceId trong JWT, kiem tra is_current trong user_devices
    if (decoded.deviceId) {
      const deviceResult = await query(
        `SELECT is_current FROM user_devices WHERE id = @deviceId AND user_id = @userId`,
        { deviceId: decoded.deviceId, userId: decoded.userId }
      );
      if (deviceResult.recordset.length > 0 && deviceResult.recordset[0].is_current === 0) {
        return next(new ApiError(401, 'Thiết bị đã bị đăng xuất từ quản trị. Vui lòng đăng nhập lại.'));
      }
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
      sessionId: decoded.sessionId || null,
      deviceId: decoded.deviceId || null,
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
