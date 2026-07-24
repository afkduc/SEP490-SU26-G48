const { query } = require('../infrastructure/database/sqlServer');

const ACTION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  FORCE_LOGO: 'FORCE_LOGO',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  RESET_PASSWORD: 'RESET_PASSWORD',
  ASSIGN_ROLE: 'ASSIGN_ROLE',
  REMOVE_ROLE: 'REMOVE_ROLE',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  FAILED_LOGIN: 'FAILED_LOGIN',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
  VERIFY_OTP: 'VERIFY_OTP',
  SEND_OTP: 'SEND_OTP',
};

const SENSITIVE_FIELDS = [
  'password',
  'new_password',
  'old_password',
  'confirm_password',
  'current_password',
  'token',
  'refresh_token',
  'access_token',
  'secret',
  'api_key',
  'private_key',
];

/**
 * Sanitize body by masking sensitive fields
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = Array.isArray(body) ? [...body] : { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (sanitized[field] !== undefined && sanitized[field] !== null) {
      sanitized[field] = '***';
    }
  }
  return sanitized;
}

/**
 * Get IP address from request
 */
function getClientIp(req) {
  const xff = req.headers ? req.headers['x-forwarded-for'] : null;
  let ip = null;
  if (xff) ip = xff.split(',')[0].trim() || null;
  if (!ip) ip = req.ip || null;
  if (!ip && req.connection) ip = req.connection.remoteAddress || null;
  if (!ip && req.socket) ip = req.socket.remoteAddress || null;
  if (!ip) {
    const h = req.headers || {};
    ip = h['x-real-ip'] || null;
  }
  return ip ? String(ip).slice(0, 45) : null;
}

/**
 * Build description string for audit log
 */
function buildDescription(action, entityName, entityCode, userName) {
  const parts = [];
  if (action) parts.push(action);
  if (entityName) parts.push(entityName);
  if (entityCode) parts.push(`(${entityCode})`);
  if (userName) parts.push(`by ${userName}`);
  return parts.join(' ') || 'Unknown action';
}

/**
 * Global audit helper - ghi log cho mọi thao tác trên hệ thống
 *
 * Cách dùng:
 *   const { auditLog } = require('./auditHelper');
 *
 *   // Ghi log thủ công
 *   await auditLog({
 *     req,
 *     action: 'ASSIGN_ROLE',
 *     tableName: 'user_role',
 *     entityCode: 'USER-001',
 *     description: 'Gán vai trò Admin cho người dùng Nguyễn Văn A',
 *   });
 *
 *   // Ghi log với old/new value (cho UPDATE/DELETE)
 *   await auditLog({
 *     req,
 *     action: 'UPDATE',
 *     tableName: 'users',
 *     entityCode: 'USER-001',
 *     oldValue: { name: 'A', email: 'a@b.com' },
 *     newValue: { name: 'B', email: 'b@b.com' },
 *   });
 *
 *   // Ghi log login/logout
 *   await auditLog({
 *     req,
 *     action: 'LOGIN',
 *     tableName: 'login_sessions',
 *     description: 'Đăng nhập thành công',
 *   });
 */
async function auditLog({
  req = {},
  res = {},
  action,
  tableName,
  entityName = null,
  entityCode = null,
  recordId = null,
  oldValue = null,
  newValue = null,
  description = null,
  responseStatus = null,
  durationMs = null,
  requestBody = null,
}) {
  try {
    const user = req.user || {};
    const userId = user.id ?? user.userId ?? null;
    const userName = user.user_name || user.name || user.email || 'system';
    const phoneNumber = user.phone || user.phone_number || null;
    const branchId = user.branch_id || null;

    const ipAddress = getClientIp(req);
    const requestMethod = req.method || null;
    const requestUrl = req.originalUrl ? String(req.originalUrl).slice(0, 500) : null;

    const sanitizedBody = requestBody ? sanitizeBody(requestBody) : (req.body ? sanitizeBody(req.body) : null);
    const requestBodyStr = sanitizedBody ? JSON.stringify(sanitizedBody) : null;

    const oldValueStr = oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : null;
    const newValueStr = newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null;

    const desc = description || buildDescription(action, entityName || tableName, entityCode, userName);

    await query(
      `INSERT INTO audit_logs (
        user_id, user_name, phone_number, action, table_name,
        entity_name, entity_code, record_id,
        ip_address, request_method, request_url, request_body,
        response_status, duration_ms, branch_id, description,
        old_value, new_value, logged_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @p1, @p2, @p3, @p4, @p5,
        @p6, @p7, @p8,
        @p9, @p10, @p11, @p12,
        @p13, @p14, @p15, @p16,
        @p17, @p18, @p19
      )`,
      {
        p1: userId,
        p2: String(userName).slice(0, 128),
        p3: phoneNumber,
        p4: action,
        p5: String(tableName || 'unknown').slice(0, 50),
        p6: entityName,
        p7: entityCode,
        p8: recordId,
        p9: ipAddress,
        p10: requestMethod,
        p11: requestUrl,
        p12: requestBodyStr,
        p13: responseStatus,
        p14: durationMs,
        p15: branchId,
        p16: desc,
        p17: oldValueStr,
        p18: newValueStr,
        p19: new Date(),
      }
    );
  } catch (err) {
    console.error('[auditHelper] Failed to write audit log:', err.message);
    // Khong throw de khong anh huong tien trinh chinh
  }
}

/**
 * Helper chi tiet hon cho cac thao tac CRUD
 */
const auditCrud = {
  async create(req, { tableName, entityCode, recordId, entityName, data }) {
    await auditLog({
      req,
      action: ACTION_TYPES.CREATE,
      tableName,
      entityCode,
      recordId,
      entityName,
      newValue: data,
      description: `Tạo mới ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`,
    });
  },

  async update(req, { tableName, entityCode, recordId, entityName, oldData, newData }) {
    await auditLog({
      req,
      action: ACTION_TYPES.UPDATE,
      tableName,
      entityCode,
      recordId,
      entityName,
      oldValue: oldData,
      newValue: newData,
      description: `Cập nhật ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`,
    });
  },

  async delete(req, { tableName, entityCode, recordId, entityName, oldData }) {
    await auditLog({
      req,
      action: ACTION_TYPES.DELETE,
      tableName,
      entityCode,
      recordId,
      entityName,
      oldValue: oldData,
      description: `Xóa ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`,
    });
  },

  async login(req, { success = true, reason = null }) {
    await auditLog({
      req,
      action: success ? ACTION_TYPES.LOGIN : ACTION_TYPES.FAILED_LOGIN,
      tableName: 'login_sessions',
      description: success ? 'Đăng nhập thành công' : `Đăng nhập thất bại${reason ? `: ${reason}` : ''}`,
      responseStatus: success ? 200 : 401,
    });
  },

  async logout(req, { reason = null }) {
    await auditLog({
      req,
      action: ACTION_TYPES.LOGOUT,
      tableName: 'login_sessions',
      description: reason ? `Đăng xuất: ${reason}` : 'Đăng xuất',
      responseStatus: 200,
    });
  },

  async forceLogout(req, { targetUserName, reason }) {
    await auditLog({
      req,
      action: ACTION_TYPES.FORCE_LOGO,
      tableName: 'login_sessions',
      description: `Buộc đăng xuất${targetUserName ? ` user ${targetUserName}` : ''}${reason ? `: ${reason}` : ''}`,
      responseStatus: 200,
    });
  },

  async changePassword(req, { targetUserName }) {
    await auditLog({
      req,
      action: ACTION_TYPES.CHANGE_PASSWORD,
      tableName: 'users',
      entityCode: targetUserName,
      description: `Đổi mật khẩu${targetUserName ? ` user ${targetUserName}` : ''}`,
    });
  },

  async resetPassword(req, { targetUserName, newPassword }) {
    await auditLog({
      req,
      action: ACTION_TYPES.RESET_PASSWORD,
      tableName: 'users',
      entityCode: targetUserName,
      description: `Đặt lại mật khẩu${targetUserName ? ` user ${targetUserName}` : ''}`,
    });
  },

  async assignRole(req, { userName, roleName }) {
    await auditLog({
      req,
      action: ACTION_TYPES.ASSIGN_ROLE,
      tableName: 'user_role',
      entityCode: userName,
      description: `Gán vai trò "${roleName}" cho user ${userName}`,
    });
  },

  async removeRole(req, { userName, roleName }) {
    await auditLog({
      req,
      action: ACTION_TYPES.REMOVE_ROLE,
      tableName: 'user_role',
      entityCode: userName,
      description: `Xóa vai trò "${roleName}" của user ${userName}`,
    });
  },

  async export(req, { fileName, dataType }) {
    await auditLog({
      req,
      action: ACTION_TYPES.EXPORT,
      tableName: dataType || 'export',
      description: `Xuất dữ liệu${fileName ? `: ${fileName}` : ''}`,
    });
  },

  async import(req, { fileName, dataType, recordCount }) {
    await auditLog({
      req,
      action: ACTION_TYPES.IMPORT,
      tableName: dataType || 'import',
      description: `Nhập dữ liệu${fileName ? `: ${fileName}` : ''}${recordCount != null ? ` (${recordCount} bản ghi)` : ''}`,
    });
  },
};

module.exports = {
  auditLog,
  auditCrud,
  ACTION_TYPES,
  sanitizeBody,
  getClientIp,
};
