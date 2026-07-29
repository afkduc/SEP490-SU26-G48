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
/**
 * Resolve branch_id tu JWT/req.user; neu thieu thi doi tu bang users.
 */
async function resolveActorBranchId(user = {}) {
  const raw = user.branch_id ?? user.branchId ?? null;
  if (raw !== null && raw !== undefined && raw !== '') {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  const userId = user.id ?? user.userId ?? null;
  if (!userId) return null;
  try {
    const result = await query(
      'SELECT branch_id FROM users WHERE id = @p1',
      { p1: userId }
    );
    const bid = result.recordset[0]?.branch_id;
    return bid != null ? Number(bid) : null;
  } catch {
    return null;
  }
}

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
    const branchId = await resolveActorBranchId(user);

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
        @p17, @p18, SYSUTCDATETIME()
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
      }
    );
    // Danh dau de auditMiddleware khong ghi trung sau khi controller da audit
    if (req && typeof req === 'object') {
      req._manualAuditWritten = true;
    }
  } catch (err) {
    console.error('[auditHelper] Failed to write audit log:', err.message);
    // Khong throw de khong anh huong tien trinh chinh
  }
}

/**
 * Helper chi tiet hon cho cac thao tac CRUD
 */
const auditCrud = {
  async create(req, { tableName, entityCode, recordId, entityName, data, description }) {
    await auditLog({
      req,
      action: ACTION_TYPES.CREATE,
      tableName,
      entityCode,
      recordId,
      entityName,
      newValue: data,
      description:
        description ||
        `Tạo mới ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`,
    });
  },

  async update(req, { tableName, entityCode, recordId, entityName, oldData, newData, description }) {
    await auditLog({
      req,
      action: ACTION_TYPES.UPDATE,
      tableName,
      entityCode,
      recordId,
      entityName,
      oldValue: oldData,
      newValue: newData,
      description:
        description ||
        `Cập nhật ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`,
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

/**
 * Mapping action_type -> notification event (dung cho auditAndNotify).
 * Cap nhat: theo yeu cau cua user -
 *   CREATE -> success (xanh la)
 *   UPDATE -> info (xanh duong)
 *   DELETE / DEACTIVATE / DISABLE -> error/critical (do)
 *   LOGIN -> success (xanh)
 *   LOGIN_FAILED -> error (do)
 *   ACTION_TYPES khac -> warning (vang)
 */
const ACTION_TO_NOTIFICATION_EVENT = {
  CREATE: 'USER_CREATED',           // generic - admin can override
  UPDATE: 'USER_UPDATED',           // generic
  DELETE: 'USER_DISABLED',          // generic - tom tat la xoa/disable
  LOGIN: 'LOGIN_SUCCESS',
  LOGOUT: 'FORCE_LOGO',
  FORCE_LOGO: 'FORCE_LOGO',
  CHANGE_PASSWORD: 'PASSWORD_CHANGED',
  RESET_PASSWORD: 'USER_PASSWORD_RESET',
  ASSIGN_ROLE: 'ROLE_CHANGED',
  REMOVE_ROLE: 'ROLE_CHANGED',
  FAILED_LOGIN: 'LOGIN_FAILED',
};

/**
 * Helper: vua ghi audit log vua notify (theo yeu cau "cứ ghi log là thông báo").
 * - Ghi audit log (qua auditCrud)
 * - Tao notification cho admin (qua NotificationService.notifyAdmins)
 * - KHONG fail main flow neu notification fail (best-effort)
 *
 * Vi du:
 *   await auditNotify.create(req, { tableName: 'users', entityName: 'Người dùng', ... })
 *
 * Params giong auditCrud, them:
 *   - notificationEvent: optional override event (vi du 'USER_CREATED' thay vi generic)
 *   - targetUserId: optional, neu muon notify 1 user cu the (khong phai admin)
 *   - details: optional, merge vao notification data
 */
const auditNotify = {
  async create(req, opts) {
    await auditCrud.create(req, opts);
    await _fireNotification(req, opts, 'CREATE');
  },

  async update(req, opts) {
    await auditCrud.update(req, opts);
    await _fireNotification(req, opts, 'UPDATE');
  },

  async delete(req, opts) {
    await auditCrud.delete(req, opts);
    await _fireNotification(req, opts, 'DELETE');
  },

  async login(req, opts) {
    await auditCrud.login(req, opts);
    await _fireNotification(req, opts, opts.success === false ? 'FAILED_LOGIN' : 'LOGIN');
  },

  async logout(req, opts) {
    if (auditCrud.logout) await auditCrud.logout(req, opts);
    await _fireNotification(req, opts, 'LOGOUT');
  },

  async forceLogout(req, opts) {
    if (auditCrud.forceLogout) await auditCrud.forceLogout(req, opts);
    await _fireNotification(req, opts, 'FORCE_LOGO');
  },

  async changePassword(req, opts) {
    if (auditCrud.changePassword) await auditCrud.changePassword(req, opts);
    await _fireNotification(req, opts, 'CHANGE_PASSWORD');
  },

  async resetPassword(req, opts) {
    if (auditCrud.resetPassword) await auditCrud.resetPassword(req, opts);
    await _fireNotification(req, opts, 'RESET_PASSWORD');
  },

  async assignRole(req, opts) {
    if (auditCrud.assignRole) await auditCrud.assignRole(req, opts);
    await _fireNotification(req, opts, 'ASSIGN_ROLE');
  },

  async removeRole(req, opts) {
    if (auditCrud.removeRole) await auditCrud.removeRole(req, opts);
    await _fireNotification(req, opts, 'REMOVE_ROLE');
  },

  /**
   * CRUD generic - goi dung khi khong match method cu the.
   * actionType: 'CREATE' | 'UPDATE' | 'DELETE' | ...
   */
  async withAction(req, { actionType, ...opts }) {
    const fn = auditCrud[actionType?.toLowerCase?.()] || auditCrud.create;
    await fn(req, opts);
    await _fireNotification(req, opts, actionType);
  },
};

/**
 * Fire notification (private). Best-effort, khong throw.
 */
async function _fireNotification(req, opts, actionType) {
  try {
    const NotificationService = require('../application/services/NotificationService');
    const ns = new NotificationService();

    // Xac dinh event type theo:
    //   1. opts.notificationEvent (explicit override)
    //   2. Mapping action -> event
    //   3. Generic fallback theo tableName
    let eventType = opts.notificationEvent || ACTION_TO_NOTIFICATION_EVENT[actionType];
    if (!eventType) {
      if (opts.tableName === 'users') {
        eventType = actionType === 'CREATE' ? 'USER_CREATED' : actionType === 'DELETE' ? 'USER_DISABLED' : 'USER_UPDATED';
      } else {
        // Skip: khong co event mapping, chi ghi log
        return;
      }
    }

    const data = {
      actorName: req?.user?.name || req?.user?.email || 'system',
      actorId: req?.user?.userId || req?.user?.id,
      targetName: opts.entityName || opts.entityCode || opts.tableName || 'unknown',
      targetCode: opts.entityCode || opts.recordId || '',
      ...opts.details,
    };

    // Neu co targetUserId -> notify user do
    if (opts.targetUserId) {
      await ns.notify(eventType, { ...data, userId: opts.targetUserId }).catch(() => {});
    } else {
      // Mac dinh: notify all admins
      await ns.notifyAdmins(eventType, data).catch(() => {});
    }
  } catch (err) {
    // Best-effort: chi log, khong fail main flow
    console.warn('[auditHelper] notification failed (non-blocking):', err.message);
  }
}

module.exports = {
  auditLog,
  auditCrud,
  auditNotify,
  ACTION_TYPES,
  ACTION_TO_NOTIFICATION_EVENT,
  sanitizeBody,
  getClientIp,
};
