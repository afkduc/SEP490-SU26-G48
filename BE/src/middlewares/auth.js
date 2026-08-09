const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { query } = require('../infrastructure/database/sqlServer');

/** Lý do đóng phiên = bị thay bởi login mới / admin force → báo "có người đăng nhập". */
function isTakeoverLogoutReason(reason) {
  const r = String(reason || '').toUpperCase();
  return r === 'FORCE_NEW_LOGIN' || r === 'FORCE_LOGOUT' || r === 'FORCE_LOGO' || r.startsWith('FORCE_');
}

function sessionTakeoverError() {
  const e = new ApiError(401, 'Đã có người đăng nhập tài khoản của bạn. Vui lòng đăng nhập lại.');
  e.code = 'SESSION_REPLACED';
  return e;
}

function sessionExpiredError(reason = 'TIMEOUT') {
  const e = new ApiError(
    401,
    reason === 'TIMEOUT'
      ? 'Phiên đăng nhập đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.'
      : 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.'
  );
  e.code = reason === 'TIMEOUT' ? 'SESSION_TIMEOUT' : 'SESSION_EXPIRED';
  return e;
}

/**
 * Phân biệt timeout / hết phiên vs bị người khác (hoặc chính mình trên thiết bị khác) đá.
 * Tránh báo "có người đăng nhập" khi chỉ đóng tab / hết hạn 30 phút.
 */
async function resolveDeadSessionError(userId, sessionId) {
  try {
    if (sessionId) {
      const sessionResult = await query(
        `SELECT status, logout_reason
         FROM login_sessions
         WHERE id = @sessionId AND user_id = @userId AND action_type = 'LOGIN'`,
        { sessionId, userId }
      );
      const row = sessionResult.recordset[0];
      if (row && isTakeoverLogoutReason(row.logout_reason)) {
        return sessionTakeoverError();
      }
      if (row && String(row.logout_reason || '').toUpperCase() === 'TIMEOUT') {
        return sessionExpiredError('TIMEOUT');
      }
      // Session ended / missing reason → hết phiên thường
      return sessionExpiredError('EXPIRED');
    }

    // Token cũ không có sessionId: xem lần đóng phiên gần nhất
    const recent = await query(
      `SELECT TOP 1 logout_reason
       FROM login_sessions
       WHERE user_id = @userId AND action_type = 'LOGIN' AND status = 'ended'
       ORDER BY COALESCE(logout_time, login_time) DESC`,
      { userId }
    );
    const reason = recent.recordset[0]?.logout_reason;
    if (isTakeoverLogoutReason(reason)) return sessionTakeoverError();
    if (String(reason || '').toUpperCase() === 'TIMEOUT') return sessionExpiredError('TIMEOUT');
    return sessionExpiredError('EXPIRED');
  } catch {
    return sessionExpiredError('EXPIRED');
  }
}

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
      // Version lệch: có thể do login mới (takeover) HOẶC login lại sau khi phiên cũ timeout.
      return next(await resolveDeadSessionError(decoded.userId, decoded.sessionId || null));
    }

    if (authRow?.status && authRow.status !== 'active') {
      return next(new ApiError(401, 'Tài khoản đã bị khóa. Vui lòng đăng nhập lại sau khi được kích hoạt.'));
    }

    if (authRow?.branch_id && authRow.branch_is_active !== undefined && !Boolean(authRow.branch_is_active)) {
      return next(new ApiError(401, 'Chi nhánh của tài khoản này đang bị ngưng hoạt động.'));
    }

    // Single-session: uu tien sessionId trong JWT.
    // Neu session van active → cho qua (phien moi vua login), khong phu thuoc
    // is_current (tranh race heartbeat/login lam is_current=0 → spinner vo han).
    if (decoded.sessionId) {
      const sessionResult = await query(
        `SELECT status, logout_reason FROM login_sessions
         WHERE id = @sessionId AND user_id = @userId AND action_type = 'LOGIN'`,
        { sessionId: decoded.sessionId, userId: decoded.userId }
      );
      const sessionRow = sessionResult.recordset[0];
      if (!sessionRow || sessionRow.status !== 'active') {
        if (sessionRow && isTakeoverLogoutReason(sessionRow.logout_reason)) {
          return next(sessionTakeoverError());
        }
        if (sessionRow && String(sessionRow.logout_reason || '').toUpperCase() === 'TIMEOUT') {
          return next(sessionExpiredError('TIMEOUT'));
        }
        return next(sessionExpiredError('EXPIRED'));
      }
    } else if (decoded.deviceId) {
      // Token cu khong co sessionId: fallback theo is_current (bit MSSQL → boolean/number)
      const deviceResult = await query(
        `SELECT is_current FROM user_devices WHERE id = @deviceId AND user_id = @userId`,
        { deviceId: decoded.deviceId, userId: decoded.userId }
      );
      if (deviceResult.recordset.length > 0) {
        const raw = deviceResult.recordset[0].is_current;
        const isCurrent = raw === 1 || raw === true;
        if (!isCurrent) {
          return next(new ApiError(401, 'Thiết bị đã bị đăng xuất từ quản trị. Vui lòng đăng nhập lại.'));
        }
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
      remember: Boolean(decoded.remember),
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
