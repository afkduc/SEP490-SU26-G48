const { query } = require('../infrastructure/database/sqlServer');
const AuditRepository = require('../infrastructure/repositories/AuditRepository');
const {
  inferEntityLifecycleStep,
  seedLifecycleFromExisting,
  buildLifecycleDescription,
} = require('./auditLifecycleStep');

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
  if (userName) parts.push(`bởi ${userName}`);
  return parts.join(' ') || 'Thao tác không xác định';
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
  branchId: branchIdOverride = null,
}) {
  try {
    const user = req.user || {};
    const userId = user.id ?? user.userId ?? null;
    const userName = user.user_name || user.name || user.email || 'system';
    const phoneNumber = user.phone || user.phone_number || null;
    const branchId = branchIdOverride ?? (await resolveActorBranchId(user));

    const ipAddress = getClientIp(req);
    const requestMethod = req.method || null;
    const requestUrl = req.originalUrl ? String(req.originalUrl).slice(0, 500) : null;

    const sanitizedBody = requestBody ? sanitizeBody(requestBody) : (req.body ? sanitizeBody(req.body) : null);
    const requestBodyStr = sanitizedBody ? JSON.stringify(sanitizedBody) : null;

    const oldValueStr = oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : null;
    const newValueStr = newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null;

    const desc = description || buildDescription(action, entityName || tableName, entityCode, userName);

    const result = await query(
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
    const insertedId = result.recordset?.[0]?.id ?? null;
    // Danh dau de auditMiddleware khong ghi trung sau khi controller da audit
    if (req && typeof req === 'object') {
      req._manualAuditWritten = true;
      if (insertedId != null) req._lastAuditLogId = insertedId;
    }
    return insertedId;
  } catch (err) {
    console.error('[auditHelper] Failed to write audit log:', err.message);
    // Khong throw de khong anh huong tien trinh chinh
    return null;
  }
}

/**
 * Rut gon payload audit: bo chu ky base64, flatten customer/vehicle de log de doc.
 */
function sanitizeAuditSnapshot(data) {
  if (data == null) return null;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditSnapshot(item));
  }
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === 'signatureData' || key === 'signature_data') {
      if (value) out.hasSignature = true;
      continue;
    }
    if (key === 'customer' && value && typeof value === 'object') {
      out.customerName = value.fullName || value.name || value.customerName || null;
      out.customerPhone = value.phone || value.phoneNumber || null;
      continue;
    }
    if (key === 'vehicle' && value && typeof value === 'object') {
      out.licensePlate = value.licensePlate || value.plateNumber || null;
      out.vehicleModel = value.vehicleModel || value.model || null;
      out.currentKm = value.currentKm != null ? value.currentKm : out.currentKm;
      continue;
    }
    if (key === 'intakeChecklist' && value && typeof value === 'object' && !Array.isArray(value)) {
      const p = value.priority && typeof value.priority === 'object' ? value.priority : {};
      const o = value.otherInfo && typeof value.otherInfo === 'object' ? value.otherInfo : {};
      out.repairRedo = Boolean(p.repairRedo);
      out.hasAppointment = Boolean(p.hasAppointment);
      out.warrantyVehicle = Boolean(p.warranty);
      out.dealerKeepsOldParts = Boolean(o.dealerKeepsOldParts);
      out.returnOldPartsToCustomer = Boolean(o.returnOldPartsToCustomer);
      out.carWash = Boolean(o.carWash);
      out.customerWaitsAtShop = Boolean(o.customerWaitsAtShop);
      continue;
    }
    if (key === 'items' && Array.isArray(value)) {
      out.items = value.map((it, index) => {
        if (!it || typeof it !== 'object') return it;
        return {
          code: it.code || it.productCode || it.product_code || null,
          description: it.description || it.productName || it.product_name || it.name || `Hạng mục ${index + 1}`,
          name: it.name || it.productName || it.product_name || it.description || null,
          qty: it.qty != null ? it.qty : it.quantity,
          unit: it.unit || null,
          unitPrice: it.unitPrice != null ? it.unitPrice : it.unit_price,
          total: it.total != null ? it.total : it.lineTotal,
          isFree: it.isFree || false,
        };
      });
      continue;
    }
    if (key === 'technicians' && Array.isArray(value)) {
      out.technicians = value.map((t) => ({
        id: t.id || t.technicianId,
        name: t.fullName || t.name || t.technicianName || `#${t.id || t.technicianId}`,
        phone: t.phone || null,
      }));
      out.technicianNames = out.technicians.map((t) => t.name).filter(Boolean).join(', ');
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Bo object long (tru khi da xu ly o tren)
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * 1 log / 1 phieu (lifecycle): tao moi neu chua co, con lai UPDATE cung dong + bump logged_at len dau list.
 *
 * @param {object} req
 * @param {object} opts
 * @param {string} opts.tableName
 * @param {number|string} opts.recordId
 * @param {string} [opts.entityCode]
 * @param {string} [opts.entityName]
 * @param {string} opts.step - ma buoc: created|updated|signed|paid|printed|assigned|completed|...
 * @param {string} [opts.stepLabel] - nhan Viet
 * @param {string} [opts.action] - CREATE|UPDATE|EXPORT...
 * @param {string} [opts.description]
 * @param {object} [opts.snapshot] - trang thai day du hien tai cua phieu
 * @param {object} [opts.meta] - them vao snapshot (status, amount,...)
 */
async function auditLifecycle(req, opts = {}) {
  const {
    tableName,
    recordId,
    entityCode = null,
    entityName = null,
    step = 'updated',
    stepLabel = null,
    action = null,
    description = null,
    snapshot = null,
    meta = null,
    responseStatus = 200,
    branchId: branchIdOverride = null,
  } = opts;

  if (!tableName || recordId == null) {
    return auditLog({
      req,
      action: action || ACTION_TYPES.UPDATE,
      tableName: tableName || 'unknown',
      entityCode,
      recordId,
      entityName,
      newValue: sanitizeAuditSnapshot(snapshot || meta),
      description,
      responseStatus,
      branchId: branchIdOverride,
    });
  }

  try {
    const user = req?.user || {};
    const userId = user.id ?? user.userId ?? null;
    const userName = user.user_name || user.name || user.email || 'system';
    const phoneNumber = user.phone || user.phone_number || null;
    const branchId = branchIdOverride ?? (await resolveActorBranchId(user));
    const ipAddress = getClientIp(req || {});
    const requestMethod = req?.method || null;
    const requestUrl = req?.originalUrl ? String(req.originalUrl).slice(0, 500) : null;
    const sanitizedBody = req?.body ? sanitizeBody(req.body) : null;
    // Khong luu chu ky base64 trong request_body
    if (sanitizedBody && typeof sanitizedBody === 'object') {
      if (sanitizedBody.signatureData) {
        sanitizedBody.hasSignature = true;
        delete sanitizedBody.signatureData;
      }
    }

    const label = stepLabel || step;
    const resolvedAction =
      action ||
      (step === 'created' || step === 'assigned' ? ACTION_TYPES.CREATE : ACTION_TYPES.UPDATE);

    const cleanSnapshot = {
      ...sanitizeAuditSnapshot(snapshot || {}),
      ...(meta && typeof meta === 'object' ? sanitizeAuditSnapshot(meta) : {}),
    };

    const existing = await AuditRepository.findLifecycleAuditLog(tableName, recordId);
    const siblings = typeof AuditRepository.listCrudAuditLogs === 'function'
      ? await AuditRepository.listCrudAuditLogs(tableName, recordId)
      : (existing ? [existing] : []);
    const seeded = seedLifecycleFromExisting(existing, siblings);

    const stepEntry = {
      step,
      label,
      at: new Date().toISOString(),
      by: userName,
      description: description || label,
    };
    const steps = [...seeded.steps, stepEntry];
    const stepLabels = steps.map((s) => s.label || s.step).filter(Boolean);
    const baseDesc =
      description ||
      `${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}: ${label}`;
    const desc = buildLifecycleDescription(baseDesc, stepLabels);

    const newValue = {
      lifecycle: true,
      currentStep: step,
      currentStepLabel: label,
      steps,
      snapshot: {
        ...seeded.snapshot,
        ...cleanSnapshot,
      },
    };
    const newValueStr = JSON.stringify(newValue);
    const requestBodyStr = sanitizedBody ? JSON.stringify(sanitizedBody) : null;

    if (existing?.id) {
      const updatedId = await AuditRepository.updateAuditLog(existing.id, {
        user_id: userId,
        user_name: String(userName).slice(0, 128),
        phone_number: phoneNumber,
        action: resolvedAction,
        entity_name: entityName,
        entity_code: entityCode,
        old_value: existing.new_value
          ? (typeof existing.new_value === 'string' ? existing.new_value : JSON.stringify(existing.new_value))
          : null,
        new_value: newValueStr,
        ip_address: ipAddress,
        request_method: requestMethod,
        request_url: requestUrl,
        request_body: requestBodyStr,
        response_status: responseStatus,
        branch_id: branchId,
        description: desc,
      });
      const extraIds = siblings.map((row) => row.id).filter((id) => id && id !== existing.id);
      if (extraIds.length && typeof AuditRepository.deleteAuditLogsByIds === 'function') {
        await AuditRepository.deleteAuditLogsByIds(extraIds).catch((e) => {
          console.warn('[auditHelper] collapse duplicate logs failed:', e.message);
        });
      }
      if (req && typeof req === 'object') {
        req._manualAuditWritten = true;
        req._lastAuditLogId = updatedId;
      }
      return updatedId;
    }

    return auditLog({
      req,
      action: resolvedAction,
      tableName,
      entityCode,
      recordId,
      entityName,
      newValue,
      description: desc,
      responseStatus,
    });
  } catch (err) {
    console.error('[auditHelper] lifecycle failed:', err.message);
    return null;
  }
}

/**
 * Helper chi tiet hon cho cac thao tac CRUD
 */
const auditCrud = {
  lifecycle: auditLifecycle,

  async create(req, { tableName, entityCode, recordId, entityName, data, description }) {
    const inferred = inferEntityLifecycleStep({ kind: 'create', data, description });
    const desc =
      description ||
      `Tạo mới ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`;
    if (recordId != null && recordId !== '') {
      return auditLifecycle(req, {
        tableName,
        entityCode,
        recordId,
        entityName,
        step: inferred.step,
        stepLabel: inferred.stepLabel,
        action: ACTION_TYPES.CREATE,
        description: desc,
        snapshot: data,
      });
    }
    return auditLog({
      req,
      action: ACTION_TYPES.CREATE,
      tableName,
      entityCode,
      recordId,
      entityName,
      newValue: data,
      description: desc,
    });
  },

  async update(req, { tableName, entityCode, recordId, entityName, oldData, newData, description }) {
    const inferred = inferEntityLifecycleStep({ kind: 'update', data: newData, description });
    const desc =
      description ||
      `Cập nhật ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`;
    if (recordId != null && recordId !== '') {
      return auditLifecycle(req, {
        tableName,
        entityCode,
        recordId,
        entityName,
        step: inferred.step,
        stepLabel: inferred.stepLabel,
        action: inferred.action === 'DELETE' ? ACTION_TYPES.DELETE : ACTION_TYPES.UPDATE,
        description: desc,
        snapshot: newData,
      });
    }
    return auditLog({
      req,
      action: ACTION_TYPES.UPDATE,
      tableName,
      entityCode,
      recordId,
      entityName,
      oldValue: oldData,
      newValue: newData,
      description: desc,
    });
  },

  async delete(req, { tableName, entityCode, recordId, entityName, oldData }) {
    const inferred = inferEntityLifecycleStep({ kind: 'delete', data: oldData });
    const desc = `Xóa ${entityName || tableName}${entityCode ? ` ${entityCode}` : ''}`;
    if (recordId != null && recordId !== '') {
      return auditLifecycle(req, {
        tableName,
        entityCode,
        recordId,
        entityName,
        step: inferred.step,
        stepLabel: inferred.stepLabel,
        action: ACTION_TYPES.DELETE,
        description: desc,
        snapshot: oldData,
      });
    }
    return auditLog({
      req,
      action: ACTION_TYPES.DELETE,
      tableName,
      entityCode,
      recordId,
      entityName,
      oldValue: oldData,
      description: desc,
    });
  },

  async login(req, { success = true, reason = null }) {
    return auditLog({
      req,
      action: success ? ACTION_TYPES.LOGIN : ACTION_TYPES.FAILED_LOGIN,
      tableName: 'login_sessions',
      description: success ? 'Đăng nhập thành công' : `Đăng nhập thất bại${reason ? `: ${reason}` : ''}`,
      responseStatus: success ? 200 : 401,
    });
  },

  async logout(req, { reason = null }) {
    return auditLog({
      req,
      action: ACTION_TYPES.LOGOUT,
      tableName: 'login_sessions',
      description: reason ? `Đăng xuất: ${reason}` : 'Đăng xuất',
      responseStatus: 200,
    });
  },

  async forceLogout(req, { targetUserName, reason }) {
    return auditLog({
      req,
      action: ACTION_TYPES.FORCE_LOGO,
      tableName: 'login_sessions',
      description: reason || 'Đăng xuất thiết bị',
      responseStatus: 200,
    });
  },

  async changePassword(req, { targetUserName, recordId = null }) {
    const desc = `Đổi mật khẩu${targetUserName ? ` người dùng ${targetUserName}` : ''}`;
    if (recordId != null && recordId !== '') {
      return auditLifecycle(req, {
        tableName: 'users',
        entityCode: targetUserName,
        recordId,
        entityName: 'Người dùng',
        step: 'password_changed',
        stepLabel: 'Đổi mật khẩu',
        action: ACTION_TYPES.CHANGE_PASSWORD,
        description: desc,
        snapshot: { passwordChanged: true },
      });
    }
    return auditLog({
      req,
      action: ACTION_TYPES.CHANGE_PASSWORD,
      tableName: 'users',
      entityCode: targetUserName,
      description: desc,
    });
  },

  async resetPassword(req, { targetUserName, newPassword, recordId = null }) {
    const desc = `Đặt lại mật khẩu${targetUserName ? ` người dùng ${targetUserName}` : ''}`;
    if (recordId != null && recordId !== '') {
      return auditLifecycle(req, {
        tableName: 'users',
        entityCode: targetUserName,
        recordId,
        entityName: 'Người dùng',
        step: 'password_reset',
        stepLabel: 'Đặt lại mật khẩu',
        action: ACTION_TYPES.RESET_PASSWORD,
        description: desc,
        snapshot: { passwordReset: true },
      });
    }
    return auditLog({
      req,
      action: ACTION_TYPES.RESET_PASSWORD,
      tableName: 'users',
      entityCode: targetUserName,
      description: desc,
    });
  },

  async assignRole(req, { userName, roleName, recordId = null }) {
    const desc = `Gán vai trò "${roleName}" cho người dùng ${userName}`;
    if (recordId != null && recordId !== '') {
      return auditLifecycle(req, {
        tableName: 'users',
        entityCode: userName,
        recordId,
        entityName: 'Người dùng',
        step: 'role_assigned',
        stepLabel: 'Gán vai trò',
        action: ACTION_TYPES.ASSIGN_ROLE,
        description: desc,
        snapshot: { roleName },
      });
    }
    return auditLog({
      req,
      action: ACTION_TYPES.ASSIGN_ROLE,
      tableName: 'user_role',
      entityCode: userName,
      description: desc,
    });
  },

  async removeRole(req, { userName, roleName, recordId = null }) {
    const desc = `Xóa vai trò "${roleName}" của người dùng ${userName}`;
    if (recordId != null && recordId !== '') {
      return auditLifecycle(req, {
        tableName: 'users',
        entityCode: userName,
        recordId,
        entityName: 'Người dùng',
        step: 'role_revoked',
        stepLabel: 'Thu hồi vai trò',
        action: ACTION_TYPES.REMOVE_ROLE,
        description: desc,
        snapshot: { roleName },
      });
    }
    return auditLog({
      req,
      action: ACTION_TYPES.REMOVE_ROLE,
      tableName: 'user_role',
      entityCode: userName,
      description: desc,
    });
  },

  async export(req, { fileName, dataType }) {
    return auditLog({
      req,
      action: ACTION_TYPES.EXPORT,
      tableName: dataType || 'export',
      description: `Xuất dữ liệu${fileName ? `: ${fileName}` : ''}`,
    });
  },

  async import(req, { fileName, dataType, recordCount }) {
    return auditLog({
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
    const auditLogId = await auditCrud.create(req, opts);
    await _fireNotification(req, opts, 'CREATE', auditLogId);
  },

  async update(req, opts) {
    const auditLogId = await auditCrud.update(req, opts);
    await _fireNotification(req, opts, 'UPDATE', auditLogId);
  },

  async delete(req, opts) {
    const auditLogId = await auditCrud.delete(req, opts);
    await _fireNotification(req, opts, 'DELETE', auditLogId);
  },

  async login(req, opts) {
    const auditLogId = await auditCrud.login(req, opts);
    await _fireNotification(req, opts, opts.success === false ? 'FAILED_LOGIN' : 'LOGIN', auditLogId);
  },

  async logout(req, opts) {
    const auditLogId = auditCrud.logout ? await auditCrud.logout(req, opts) : null;
    await _fireNotification(req, opts, 'LOGOUT', auditLogId);
  },

  async forceLogout(req, opts) {
    const auditLogId = auditCrud.forceLogout ? await auditCrud.forceLogout(req, opts) : null;
    await _fireNotification(req, opts, 'FORCE_LOGO', auditLogId);
  },

  async changePassword(req, opts) {
    const auditLogId = auditCrud.changePassword ? await auditCrud.changePassword(req, opts) : null;
    await _fireNotification(req, opts, 'CHANGE_PASSWORD', auditLogId);
  },

  async resetPassword(req, opts) {
    const auditLogId = auditCrud.resetPassword ? await auditCrud.resetPassword(req, opts) : null;
    await _fireNotification(req, opts, 'RESET_PASSWORD', auditLogId);
  },

  async assignRole(req, opts) {
    const auditLogId = auditCrud.assignRole ? await auditCrud.assignRole(req, opts) : null;
    await _fireNotification(req, opts, 'ASSIGN_ROLE', auditLogId);
  },

  async removeRole(req, opts) {
    const auditLogId = auditCrud.removeRole ? await auditCrud.removeRole(req, opts) : null;
    await _fireNotification(req, opts, 'REMOVE_ROLE', auditLogId);
  },

  /**
   * CRUD generic - goi dung khi khong match method cu the.
   * actionType: 'CREATE' | 'UPDATE' | 'DELETE' | ...
   */
  async withAction(req, { actionType, ...opts }) {
    const fn = auditCrud[actionType?.toLowerCase?.()] || auditCrud.create;
    const auditLogId = await fn(req, opts);
    await _fireNotification(req, opts, actionType, auditLogId);
  },
};

/**
 * Fire notification (private). Best-effort, khong throw.
 */
async function _fireNotification(req, opts, actionType, auditLogId = null) {
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
      auditLogId: auditLogId ?? req?._lastAuditLogId ?? null,
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
  auditLifecycle,
  auditCrud,
  auditNotify,
  ACTION_TYPES,
  ACTION_TO_NOTIFICATION_EVENT,
  sanitizeBody,
  sanitizeAuditSnapshot,
  getClientIp,
};
