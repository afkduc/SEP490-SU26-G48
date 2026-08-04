const { query } = require('../database/sqlServer');
const {
  sqlAccentInsensitiveLike,
  bindNormalizedLikeParam,
} = require('../../utils/vietnamese');

/** Auth noise — có trang Lịch sử đăng nhập riêng; mặc định ẩn khỏi nhật ký thao tác. */
const AUTH_AUDIT_ACTIONS = [
  'LOGIN',
  'FAILED_LOGIN',
  'LOGOUT',
  'FORCE_LOGOUT',
  'FORCE_LOGO',
  'REFRESH_TOKEN',
  'VERIFY_OTP',
  'SEND_OTP',
];

function bindNormalizedLike(params, paramIndex, rawValue) {
  const key = `p${paramIndex}`;
  bindNormalizedLikeParam(params, key, rawValue);
  return { key, nextIndex: paramIndex + 1 };
}

function likeAccentInsensitive(columnExpr, paramName) {
  return sqlAccentInsensitiveLike(columnExpr, paramName);
}

function toIsoUtc(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return value;
}

const AUDIT_LOG_COLUMNS = `
  al.id,
  al.user_id,
  al.user_name,
  al.phone_number,
  al.action,
  al.table_name,
  al.entity_name,
  al.entity_code,
  al.record_id,
  al.ip_address,
  al.request_method,
  al.request_url,
  al.request_body,
  al.response_status,
  al.duration_ms,
  COALESCE(al.branch_id, u.branch_id) AS branch_id,
  COALESCE(
    b.branch_name,
    ub.branch_name,
    CASE
      -- Thao tac he thong (quen mat khau cong khai, job, ...) — khong gan chi nhanh
      WHEN al.user_id IS NULL OR LOWER(LTRIM(RTRIM(ISNULL(al.user_name, N'')))) = N'system'
        THEN N'Hệ thống'
      -- Admin / GD all-scope
      WHEN u.id IS NOT NULL AND u.branch_id IS NULL THEN N'Tất cả chi nhánh'
      ELSE NULL
    END
  ) AS branch_name,
  al.description,
  al.old_value,
  al.new_value,
  al.logged_at
`;

/**
 * Chi nhánh hiển thị:
 *  1) al.branch_id ghi lúc audit
 *  2) fallback users.branch_id của người thao tác (log cũ thiếu branch_id)
 *  3) actor «system» / không user → «Hệ thống»
 *  4) admin/all-scope (users.branch_id NULL) → «Tất cả chi nhánh»
 */
const AUDIT_LOG_FROM = `
  audit_logs al
  LEFT JOIN users u ON u.id = al.user_id
  LEFT JOIN branches b ON b.id = al.branch_id
  LEFT JOIN branches ub ON ub.id = u.branch_id
`;

const LOGIN_SESSION_COLUMNS = `
  ls.id,
  ls.user_id,
  ls.user_name,
  ls.phone,
  ls.action_type,
  ls.ip_address,
  ls.user_agent,
  ls.browser,
  ls.os,
  ls.login_time,
  ls.logout_time,
  ls.session_duration_seconds,
  ls.logout_reason,
  ls.failure_reason,
  ls.branch_id,
  ls.status,
  br.branch_name
`;

function toAuditLogRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    phone_number: row.phone_number,
    action: row.action,
    table_name: row.table_name,
    entity_name: row.entity_name,
    entity_code: row.entity_code,
    record_id: row.record_id,
    ip_address: row.ip_address,
    request_method: row.request_method,
    request_url: row.request_url,
    request_body: row.request_body,
    response_status: row.response_status,
    duration_ms: row.duration_ms,
    branch_id: row.branch_id,
    branch_name: row.branch_name,
    description: row.description,
    old_value: row.old_value,
    new_value: row.new_value,
    logged_at: toIsoUtc(row.logged_at),
  };
}

function toLoginSessionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    phone_number: row.phone,
    action_type: row.action_type,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    browser: row.browser,
    os: row.os,
    login_time: row.login_time,
    logout_time: row.logout_time,
    session_duration_seconds: row.session_duration_seconds,
    logout_reason: row.logout_reason,
    failure_reason: row.failure_reason,
    branch_id: row.branch_id,
    branch_name: row.branch_name,
    status: row.status,
  };
}

function toEntityDefinitionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    entityName: row.entity_name,
    entityCode: row.entity_code,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertAuditLog(logData) {
  const {
    user_id = null,
    user_name,
    phone_number = null,
    action,
    table_name,
    entity_name = null,
    entity_code = null,
    record_id = null,
    old_value = null,
    new_value = null,
    ip_address = null,
    request_method = null,
    request_url = null,
    request_body = null,
    response_status = null,
    duration_ms = null,
    branch_id = null,
    description = null,
    logged_at = null,
  } = logData || {};

  const params = {
    p1: user_id,
    p2: user_name,
    p3: phone_number,
    p4: action,
    p5: table_name,
    p6: entity_name,
    p7: entity_code,
    p8: record_id,
    p9: old_value,
    p10: new_value,
    p11: ip_address,
    p12: request_method,
    p13: request_url,
    p14: request_body,
    p15: response_status,
    p16: duration_ms,
    p17: branch_id,
    p18: description,
    p19: logged_at,
  };

  const result = await query(
    `INSERT INTO audit_logs (
       user_id,
       user_name,
       phone_number,
       action,
       table_name,
       entity_name,
       entity_code,
       record_id,
       old_value,
       new_value,
       ip_address,
       request_method,
       request_url,
       request_body,
       response_status,
       duration_ms,
       branch_id,
       description,
       logged_at
     )
     OUTPUT INSERTED.id
     VALUES (
       @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10,
       @p11, @p12, @p13, @p14, @p15, @p16, @p17, @p18,
       COALESCE(@p19, SYSUTCDATETIME())
     )`,
    params
  );

  return result.recordset[0].id;
}

/**
 * Get audit logs with filters and stats
 */
async function getAuditLogs(filters = {}) {
  const {
    keyword,
    userName,
    phone,
    action,
    tableName,
    entityName,
    entityCode,
    ipAddress,
    requestMethod,
    responseStatus,
    startDate,
    endDate,
    branchId,
    excludeAuthEvents = false,
    page = 1,
    pageSize = 20,
  } = filters;

  const conditions = ['1=1'];
  const params = {};
  let paramIndex = 1;

  // Keyword search — tên / SĐT / mô tả / mã… (không phân biệt hoa thường & dấu)
  if (keyword) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, keyword);
    conditions.push(`(
      ${likeAccentInsensitive('al.user_name', key)} OR
      ${likeAccentInsensitive('al.phone_number', key)} OR
      ${likeAccentInsensitive('al.description', key)} OR
      ${likeAccentInsensitive('al.entity_name', key)} OR
      ${likeAccentInsensitive('al.entity_code', key)} OR
      ${likeAccentInsensitive('al.table_name', key)} OR
      ${likeAccentInsensitive('al.request_url', key)}
    )`);
    paramIndex = nextIndex;
  }

  // Ô "Người dùng": khớp tên hoặc SĐT
  if (userName) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, userName);
    conditions.push(`(
      ${likeAccentInsensitive('al.user_name', key)} OR
      ${likeAccentInsensitive('al.phone_number', key)}
    )`);
    paramIndex = nextIndex;
  }

  if (phone) {
    conditions.push(`LOWER(al.phone_number) LIKE LOWER(@p${paramIndex})`);
    params[`p${paramIndex}`] = `%${phone}%`;
    paramIndex++;
  }

  if (action) {
    conditions.push(`al.action = @p${paramIndex}`);
    params[`p${paramIndex}`] = action;
    paramIndex++;
  } else if (excludeAuthEvents) {
    // An dang nhap / that bai khoi danh sach thao tac (co trang Lich su dang nhap rieng)
    const placeholders = AUTH_AUDIT_ACTIONS.map((a, i) => {
      const key = `p${paramIndex + i}`;
      params[key] = a;
      return `@${key}`;
    });
    conditions.push(`al.action NOT IN (${placeholders.join(', ')})`);
    paramIndex += AUTH_AUDIT_ACTIONS.length;
  }

  if (tableName) {
    conditions.push(`LOWER(al.table_name) LIKE LOWER(@p${paramIndex})`);
    params[`p${paramIndex}`] = `%${tableName}%`;
    paramIndex++;
  }

  if (entityName) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, entityName);
    conditions.push(likeAccentInsensitive('al.entity_name', key));
    paramIndex = nextIndex;
  }

  if (entityCode) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, entityCode);
    conditions.push(likeAccentInsensitive('al.entity_code', key));
    paramIndex = nextIndex;
  }

  if (ipAddress) {
    conditions.push(`al.ip_address LIKE @p${paramIndex}`);
    params[`p${paramIndex}`] = `%${ipAddress}%`;
    paramIndex++;
  }

  if (requestMethod) {
    conditions.push(`al.request_method = @p${paramIndex}`);
    params[`p${paramIndex}`] = requestMethod;
    paramIndex++;
  }

  if (responseStatus) {
    if (responseStatus === '2xx') {
      conditions.push(`al.response_status >= 200 AND al.response_status < 300`);
    } else if (responseStatus === '4xx') {
      conditions.push(`al.response_status >= 400 AND al.response_status < 500`);
    } else if (responseStatus === '5xx') {
      conditions.push(`al.response_status >= 500`);
    } else {
      conditions.push(`al.response_status = @p${paramIndex}`);
      params[`p${paramIndex}`] = parseInt(responseStatus, 10);
      paramIndex++;
    }
  }

  if (branchId) {
    conditions.push(`COALESCE(al.branch_id, u.branch_id) = @p${paramIndex}`);
    params[`p${paramIndex}`] = branchId;
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`al.logged_at >= @p${paramIndex}`);
    params[`p${paramIndex}`] = startDate;
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`al.logged_at <= @p${paramIndex}`);
    params[`p${paramIndex}`] = endDate;
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.max(1, Math.min(parseInt(pageSize, 10) || 20, 100));
  const offset = (safePage - 1) * safePageSize;

  // Get count and stats in parallel
  const [countResult, statsResult] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total FROM ${AUDIT_LOG_FROM} WHERE ${whereClause}`,
      params
    ),
    query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN al.action IN ('CREATE', 'INSERT') THEN 1 ELSE 0 END) AS create_count,
        SUM(CASE WHEN al.action IN ('UPDATE', 'EDIT') THEN 1 ELSE 0 END) AS update_count,
        SUM(CASE WHEN al.action IN ('DELETE', 'REMOVE') THEN 1 ELSE 0 END) AS delete_count
       FROM ${AUDIT_LOG_FROM} WHERE ${whereClause}`,
      params
    ),
  ]);

  const total = countResult.recordset[0].total;
  const stats = statsResult.recordset[0];

  const dataResult = await query(
    `SELECT ${AUDIT_LOG_COLUMNS}
     FROM   ${AUDIT_LOG_FROM}
     WHERE  ${whereClause}
     ORDER  BY al.logged_at DESC, al.id DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    { ...params, offset, pageSize: safePageSize }
  );

  const items = dataResult.recordset.map(toAuditLogRow);

  return {
    total,
    page: safePage,
    pageSize: safePageSize,
    items,
    stats: {
      total: stats.total || 0,
      create: stats.create_count || 0,
      update: stats.update_count || 0,
      delete: stats.delete_count || 0,
    },
  };
}

/**
 * Get single audit log by ID
 */
async function getAuditLogById(id) {
  const result = await query(
    `SELECT ${AUDIT_LOG_COLUMNS}
     FROM   ${AUDIT_LOG_FROM}
     WHERE  al.id = @p1`,
    { p1: id }
  );

  if (result.recordset.length === 0) {
    return null;
  }

  return toAuditLogRow(result.recordset[0]);
}

async function getAuditLogsForExport(filters = {}) {
  const {
    keyword,
    userName,
    phone,
    action,
    tableName,
    entityName,
    entityCode,
    ipAddress,
    requestMethod,
    responseStatus,
    startDate,
    endDate,
    branchId,
    excludeAuthEvents = false,
    limit = 10000,
  } = filters;

  const conditions = ['1=1'];
  const params = {};
  let paramIndex = 1;

  if (keyword) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, keyword);
    conditions.push(`(
      ${likeAccentInsensitive('al.user_name', key)} OR
      ${likeAccentInsensitive('al.phone_number', key)} OR
      ${likeAccentInsensitive('al.description', key)} OR
      ${likeAccentInsensitive('al.entity_name', key)} OR
      ${likeAccentInsensitive('al.entity_code', key)} OR
      ${likeAccentInsensitive('al.table_name', key)} OR
      ${likeAccentInsensitive('al.request_url', key)}
    )`);
    paramIndex = nextIndex;
  }

  if (userName) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, userName);
    conditions.push(`(
      ${likeAccentInsensitive('al.user_name', key)} OR
      ${likeAccentInsensitive('al.phone_number', key)}
    )`);
    paramIndex = nextIndex;
  }
  if (phone) {
    conditions.push(`LOWER(al.phone_number) LIKE LOWER(@p${paramIndex})`);
    params[`p${paramIndex}`] = `%${phone}%`;
    paramIndex++;
  }
  if (action) {
    conditions.push(`al.action = @p${paramIndex}`);
    params[`p${paramIndex}`] = action;
    paramIndex++;
  } else if (excludeAuthEvents) {
    const placeholders = AUTH_AUDIT_ACTIONS.map((a, i) => {
      const key = `p${paramIndex + i}`;
      params[key] = a;
      return `@${key}`;
    });
    conditions.push(`al.action NOT IN (${placeholders.join(', ')})`);
    paramIndex += AUTH_AUDIT_ACTIONS.length;
  }
  if (tableName) {
    conditions.push(`LOWER(al.table_name) LIKE LOWER(@p${paramIndex})`);
    params[`p${paramIndex}`] = `%${tableName}%`;
    paramIndex++;
  }
  if (entityName) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, entityName);
    conditions.push(likeAccentInsensitive('al.entity_name', key));
    paramIndex = nextIndex;
  }
  if (entityCode) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, entityCode);
    conditions.push(likeAccentInsensitive('al.entity_code', key));
    paramIndex = nextIndex;
  }
  if (ipAddress) {
    conditions.push(`al.ip_address LIKE @p${paramIndex}`);
    params[`p${paramIndex}`] = `%${ipAddress}%`;
    paramIndex++;
  }
  if (requestMethod) {
    conditions.push(`al.request_method = @p${paramIndex}`);
    params[`p${paramIndex}`] = requestMethod;
    paramIndex++;
  }
  if (responseStatus) {
    if (responseStatus === '2xx') {
      conditions.push(`al.response_status >= 200 AND al.response_status < 300`);
    } else if (responseStatus === '4xx') {
      conditions.push(`al.response_status >= 400 AND al.response_status < 500`);
    } else if (responseStatus === '5xx') {
      conditions.push(`al.response_status >= 500`);
    } else {
      conditions.push(`al.response_status = @p${paramIndex}`);
      params[`p${paramIndex}`] = parseInt(responseStatus, 10);
      paramIndex++;
    }
  }
  if (branchId) {
    conditions.push(`COALESCE(al.branch_id, u.branch_id) = @p${paramIndex}`);
    params[`p${paramIndex}`] = branchId;
    paramIndex++;
  }
  if (startDate) {
    conditions.push(`al.logged_at >= @p${paramIndex}`);
    params[`p${paramIndex}`] = startDate;
    paramIndex++;
  }
  if (endDate) {
    conditions.push(`al.logged_at <= @p${paramIndex}`);
    params[`p${paramIndex}`] = endDate;
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10000, 10000));

  const dataResult = await query(
    `SELECT ${AUDIT_LOG_COLUMNS}
     FROM   ${AUDIT_LOG_FROM}
     WHERE  ${whereClause}
     ORDER  BY al.logged_at DESC, al.id DESC
     OFFSET 0 ROWS FETCH NEXT @p_limit ROWS ONLY`,
    { ...params, p_limit: safeLimit }
  );

  const items = dataResult.recordset.map(toAuditLogRow);
  return { items, total: items.length, truncated: items.length >= safeLimit };
}

async function getLoginSessions(filters = {}) {
  const {
    userName,
    phone,
    actionType,
    startDate,
    endDate,
    status,
    branchId,
    ipAddress,
    sessionId,
    page = 1,
    pageSize = 20,
  } = filters;

  const conditions = ['1=1'];
  const params = {};
  let paramIndex = 1;

  // Exact session — dùng khi admin nhảy từ cảnh báo (kể cả phiên đã ended/offline)
  if (sessionId != null && String(sessionId).trim() !== '') {
    const sid = Number(sessionId);
    if (Number.isFinite(sid) && sid > 0) {
      conditions.push(`ls.id = @p${paramIndex}`);
      params[`p${paramIndex}`] = sid;
      paramIndex++;
    }
  }

  // Tên người dùng: khớp tên trên phiên hoặc SĐT / email / họ tên trên bảng users
  if (userName) {
    const { key, nextIndex } = bindNormalizedLike(params, paramIndex, userName);
    conditions.push(`(
      ${likeAccentInsensitive('ls.user_name', key)}
      OR ${likeAccentInsensitive('ls.phone', key)}
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = ls.user_id AND (
          ${likeAccentInsensitive('u.email', key)}
          OR ${likeAccentInsensitive('u.phone', key)}
          OR ${likeAccentInsensitive('u.user_name', key)}
          OR ${likeAccentInsensitive('u.first_name', key)}
          OR ${likeAccentInsensitive('u.last_name', key)}
          OR ${likeAccentInsensitive(`(COALESCE(u.first_name, N'') + N' ' + COALESCE(u.last_name, N''))`, key)}
        )
      )
    )`);
    paramIndex = nextIndex;
  }

  if (phone) {
    conditions.push(`LOWER(ls.phone) LIKE LOWER(@p${paramIndex})`);
    params[`p${paramIndex}`] = `%${phone}%`;
    paramIndex++;
  }

  if (actionType) {
    conditions.push(`ls.action_type = @p${paramIndex}`);
    params[`p${paramIndex}`] = actionType;
    paramIndex++;
  }

  if (status) {
    conditions.push(`ls.status = @p${paramIndex}`);
    params[`p${paramIndex}`] = status;
    paramIndex++;
  }

  if (branchId) {
    conditions.push(`ls.branch_id = @p${paramIndex}`);
    params[`p${paramIndex}`] = branchId;
    paramIndex++;
  }

  if (ipAddress) {
    conditions.push(`ls.ip_address LIKE @p${paramIndex}`);
    params[`p${paramIndex}`] = `%${ipAddress}%`;
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`ls.login_time >= @p${paramIndex}`);
    params[`p${paramIndex}`] = startDate;
    paramIndex++;
  }

  if (endDate) {
    // Bao gồm cả ngày endDate (so sánh tới cuối ngày nếu chỉ YYYY-MM-DD)
    const endRaw = String(endDate);
    const endInclusive = /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
      ? `${endRaw} 23:59:59`
      : endDate;
    conditions.push(`ls.login_time <= @p${paramIndex}`);
    params[`p${paramIndex}`] = endInclusive;
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 20);
  const offset = (safePage - 1) * safePageSize;

  const [countResult, statsResult] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total
       FROM   login_sessions ls
       WHERE  ${whereClause}`,
      params
    ),
    query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ls.action_type = 'LOGIN' THEN 1 ELSE 0 END) AS login_count,
         SUM(CASE WHEN ls.action_type = 'LOGIN_FAILED' THEN 1 ELSE 0 END) AS failed_count,
         SUM(CASE WHEN ls.status = 'active' THEN 1 ELSE 0 END) AS active_count
       FROM   login_sessions ls
       WHERE  ${whereClause}`,
      params
    ),
  ]);
  const total = countResult.recordset[0].total;
  const stats = statsResult.recordset[0];

  const dataResult = await query(
    `SELECT ${LOGIN_SESSION_COLUMNS}
     FROM   login_sessions ls
     LEFT   JOIN branches br ON br.id = ls.branch_id
     WHERE  ${whereClause}
     ORDER  BY
       CASE WHEN ls.status = 'active' THEN 0 ELSE 1 END,
       CASE WHEN ls.status = 'active' THEN ls.login_time ELSE COALESCE(ls.logout_time, ls.login_time) END DESC,
       ls.id DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    { ...params, offset, pageSize: safePageSize }
  );

  const items = dataResult.recordset.map(toLoginSessionRow);

  return {
    total,
    page: safePage,
    pageSize: safePageSize,
    items,
    stats: {
      total: stats.total || 0,
      loginCount: stats.login_count || 0,
      failedCount: stats.failed_count || 0,
      activeCount: stats.active_count || 0,
    },
  };
}

async function getLoginSessionsSince(sinceDate, limit = 50) {
  const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
  const result = await query(
    `SELECT ${LOGIN_SESSION_COLUMNS}
     FROM   login_sessions ls
     LEFT   JOIN branches br ON br.id = ls.branch_id
     WHERE  ls.login_time  > @p1
        OR  ls.logout_time > @p1
     ORDER  BY COALESCE(ls.logout_time, ls.login_time) DESC, ls.id DESC
     OFFSET 0 ROWS FETCH NEXT @p2 ROWS ONLY`,
    { p1: sinceDate, p2: safeLimit }
  );
  return result.recordset.map(toLoginSessionRow);
}

async function getEntityDefinitions() {
  const result = await query(
    `SELECT id, table_name, entity_name, prefix_code, icon
     FROM   entity_definitions
     ORDER  BY entity_name ASC`
  );
  return result.recordset.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    entityName: row.entity_name,
    prefixCode: row.prefix_code,
    icon: row.icon,
  }));
}

async function getAuditLogsByUser(userId, limit = 10) {
  const safeLimit = Math.max(1, parseInt(limit, 10) || 10);
  const result = await query(
    `SELECT TOP (@p2) ${AUDIT_LOG_COLUMNS}
     FROM   ${AUDIT_LOG_FROM}
     WHERE  al.user_id = @p1
     ORDER  BY al.logged_at DESC, al.id DESC`,
    { p1: userId, p2: safeLimit }
  );
  return result.recordset.map(toAuditLogRow);
}

module.exports = {
  insertAuditLog,
  getAuditLogs,
  getAuditLogById,
  getAuditLogsForExport,
  getLoginSessions,
  getLoginSessionsSince,
  getEntityDefinitions,
  getAuditLogsByUser,
  AUTH_AUDIT_ACTIONS,
};
