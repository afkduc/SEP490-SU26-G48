const { query } = require('../database/sqlServer');
const { assignedBranchCountSql, resolveAssignedBranchIds } = require('../../utils/userBranchScope');
const {
  sqlAccentInsensitiveLike,
  bindNormalizedLikeParam,
  bindPhoneDigitsLikeParam,
  sqlPhoneDigitsLike,
  sqlPhoneDigitsExpr,
  phoneDigitsOnly,
} = require('../../utils/vietnamese');
const { parseUtcRangeFromVnDates, startOfDayVN, todayYmdVN } = require('../../utils/dateVN');

/** Điều kiện search users: tên/email (bỏ dấu) + SĐT theo chữ số (contains). */
function pushUserSearchCondition(conditions, params, paramIndex, search) {
  const key = `p${paramIndex}`;
  bindNormalizedLikeParam(params, key, search);
  const parts = [
    sqlAccentInsensitiveLike('u.user_name', key),
    sqlAccentInsensitiveLike('u.email', key),
    sqlAccentInsensitiveLike('u.first_name', key),
    sqlAccentInsensitiveLike('u.last_name', key),
    sqlAccentInsensitiveLike(
      `(COALESCE(u.first_name, N'') + N' ' + COALESCE(u.last_name, N''))`,
      key
    ),
  ];
  let next = paramIndex + 1;
  const phoneKey = `p${next}`;
  if (bindPhoneDigitsLikeParam(params, phoneKey, search)) {
    parts.push(sqlPhoneDigitsLike('u.phone', phoneKey));
    next += 1;
  }
  conditions.push(`(${parts.join(' OR ')})`);
  return next;
}

const ADMIN_USER_COLUMNS = `
  u.id,
  u.user_name,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.branch_id,
  b.branch_name,
  u.status,
  u.created_at,
  ${assignedBranchCountSql('u')},
  (SELECT MAX(ud.last_login_at) FROM user_devices ud WHERE ud.user_id = u.id) AS last_login_at
`;

function toAdminUserRow(row) {
  if (!row) return null;
  const assignedCount = Number(row.assigned_branch_count) || 0;
  // "Tất cả chi nhánh" = không gắn branch_id chính (Admin / GD kiểu all-scope)
  const scopeAllBranches = row.branch_id === null || row.branch_id === undefined;
  return {
    id: row.id,
    name: row.user_name,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    branchId: row.branch_id,
    branchName: row.branch_name,
    scopeAllBranches,
    assignedBranchCount: assignedCount,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || null,
    roles: [],
  };
}

class AdminUserRepositoryImpl {
  async findAll({ search, branchId, roleId, status, page = 1, pageSize = 10 }) {
    const conditions = ['1=1'];
    const params = {};
    let paramIndex = 1;

    if (search) {
      paramIndex = pushUserSearchCondition(conditions, params, paramIndex, search);
    }

    if (branchId) {
      conditions.push(`u.branch_id = @p${paramIndex}`);
      params[`p${paramIndex}`] = branchId;
      paramIndex++;
    }

    if (roleId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM user_role ur
        WHERE ur.user_id = u.id AND ur.role_id = @p${paramIndex}
      )`);
      params[`p${paramIndex}`] = Number(roleId);
      paramIndex++;
    }

    if (status) {
      conditions.push(`u.status = @p${paramIndex}`);
      params[`p${paramIndex}`] = status;
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Lay roles cho tat ca user trong page
    const offset = (page - 1) * pageSize;

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM users u WHERE ${whereClause}`,
      params
    );
    const total = countResult.recordset[0].total;

    const dataResult = await query(
      `SELECT ${ADMIN_USER_COLUMNS}
       FROM   users u
       LEFT   JOIN branches b ON b.id = u.branch_id
       WHERE  ${whereClause}
       ORDER  BY u.id ASC
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { ...params, offset, pageSize }
    );

    const users = dataResult.recordset.map(toAdminUserRow);

    // Lay roles (name + id) cho tung user
    if (users.length > 0) {
      const userIds = users.map((u) => u.id);
      const rolesResult = await query(
        `SELECT ur.user_id, r.id AS role_id, r.role_name
         FROM   user_role ur
         JOIN   roles r ON r.id = ur.role_id
         WHERE  ur.user_id IN (${userIds.map((_, i) => `@p${paramIndex + i}`).join(',')})`,
        Object.fromEntries(userIds.map((id, i) => [`p${paramIndex + i}`, id]))
      );
      const rolesByUser = {};
      for (const row of rolesResult.recordset) {
        if (!rolesByUser[row.user_id]) rolesByUser[row.user_id] = [];
        rolesByUser[row.user_id].push({ roleId: row.role_id, roleName: row.role_name });
      }
      for (const user of users) {
        user.roles = rolesByUser[user.id] || [];
      }
    }

    return { items: users, total, page, pageSize };
  }

  /**
   * Lay full users (khong phan trang) de export Excel.
   * Cap toi da 10000 rows de bao ve DB.
   */
  async findAllForExport({ search, branchId, roleId, status, limit = 10000 } = {}) {
    const conditions = ['1=1'];
    const params = {};
    let paramIndex = 1;

    if (search) {
      paramIndex = pushUserSearchCondition(conditions, params, paramIndex, search);
    }

    if (branchId) {
      conditions.push(`u.branch_id = @p${paramIndex}`);
      params[`p${paramIndex}`] = branchId;
      paramIndex++;
    }

    if (roleId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM user_role ur
        WHERE ur.user_id = u.id AND ur.role_id = @p${paramIndex}
      )`);
      params[`p${paramIndex}`] = Number(roleId);
      paramIndex++;
    }

    if (status) {
      conditions.push(`u.status = @p${paramIndex}`);
      params[`p${paramIndex}`] = status;
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10000, 10000));

    const dataResult = await query(
      `SELECT ${ADMIN_USER_COLUMNS}
       FROM   users u
       LEFT   JOIN branches b ON b.id = u.branch_id
       WHERE  ${whereClause}
       ORDER  BY u.id ASC
       OFFSET 0 ROWS FETCH NEXT @p_limit ROWS ONLY`,
      { ...params, p_limit: safeLimit }
    );

    const users = dataResult.recordset.map(toAdminUserRow);

    // Lay roles cho cac user
    if (users.length > 0) {
      const userIds = users.map((u) => u.id);
      const rolesResult = await query(
        `SELECT ur.user_id, r.id AS role_id, r.role_name
         FROM   user_role ur
         JOIN   roles r ON r.id = ur.role_id
         WHERE  ur.user_id IN (${userIds.map((_, i) => `@p${paramIndex + i}`).join(',')})`,
        Object.fromEntries(userIds.map((id, i) => [`p${paramIndex + i}`, id]))
      );
      const rolesByUser = {};
      for (const row of rolesResult.recordset) {
        if (!rolesByUser[row.user_id]) rolesByUser[row.user_id] = [];
        rolesByUser[row.user_id].push({ roleId: row.role_id, roleName: row.role_name });
      }
      for (const user of users) {
        user.roles = rolesByUser[user.id] || [];
      }
    }

    return { items: users, total: users.length, truncated: users.length >= safeLimit };
  }

  async countAllUsers() {
    const result = await query('SELECT COUNT(*) AS total FROM users');
    return result.recordset[0].total;
  }

  /**
   * Lay tat ca branches cho dropdown filter
   * Chi tra ve id + branch_name (toi uu cho UI dropdown)
   */
  async findAllBranches() {
    const result = await query(
      `SELECT id, branch_name
       FROM   branches
       WHERE  is_active = 1
       ORDER  BY branch_name ASC`
    );
    return result.recordset.map((row) => ({
      id: row.id,
      branchName: row.branch_name,
    }));
  }

  /**
   * Lay tat ca roles cho dropdown filter
   * Tra ve id + role_name
   */
  async findAllRoles() {
    const result = await query(
      `SELECT id, role_name
       FROM   roles
       ORDER  BY role_name ASC`
    );
    return result.recordset.map((row) => ({
      id: row.id,
      roleName: row.role_name,
    }));
  }

  async findById(id) {
    const result = await query(
      `SELECT ${ADMIN_USER_COLUMNS}
       FROM   users u
       LEFT   JOIN branches b ON b.id = u.branch_id
       WHERE  u.id = @p1`,
      { p1: id }
    );
    const row = result.recordset[0];
    if (!row) return null;
    const user = toAdminUserRow(row);
    const rolesResult = await query(
      `SELECT r.id AS role_id, r.role_name
       FROM   user_role ur
       JOIN   roles r ON r.id = ur.role_id
       WHERE  ur.user_id = @p1`,
      { p1: id }
    );
    user.roles = rolesResult.recordset.map((r) => ({
      roleId: r.role_id,
      roleName: r.role_name,
    }));

    user.assignedBranchIds = await resolveAssignedBranchIds(user.branchId);

    return user;
  }

  async findByEmail(email) {
    const result = await query('SELECT TOP 1 id, email FROM users WHERE email = @p1', {
      p1: email,
    });
    return result.recordset[0] || null;
  }

  async findByPhone(phone) {
    const digits = phoneDigitsOnly(phone);
    if (!digits) return null;
    const result = await query(
      `SELECT TOP 1 id, phone FROM users
       WHERE ${sqlPhoneDigitsExpr('phone')} = @p1`,
      { p1: digits }
    );
    return result.recordset[0] || null;
  }

  async findRoleById(roleId) {
    const result = await query(
      `SELECT id, role_name AS roleName, role_label AS roleLabel,
              ISNULL(is_active, 1) AS isActive
       FROM roles WHERE id = @p1`,
      { p1: Number(roleId) }
    );
    const row = result.recordset[0];
    if (!row) return null;
    return {
      id: row.id,
      roleName: row.roleName,
      roleLabel: row.roleLabel,
      isActive: Boolean(row.isActive),
    };
  }

  async findBranchById(branchId) {
    const result = await query(
      `SELECT id, branch_code AS branchCode, branch_name AS branchName,
              ISNULL(is_active, 1) AS isActive
       FROM branches WHERE id = @p1`,
      { p1: Number(branchId) }
    );
    const row = result.recordset[0];
    if (!row) return null;
    return {
      id: row.id,
      branchCode: row.branchCode,
      branchName: row.branchName,
      isActive: Boolean(row.isActive),
    };
  }

  async nextPseudoId() {
    const result = await query(
      `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(pseudo_id, 3, LEN(pseudo_id) - 2) AS INT)), 0) + 1 AS next_num
       FROM users
       WHERE pseudo_id LIKE 'NV%'`
    );
    const nextNum = result.recordset[0].next_num;
    return `NV${String(nextNum).padStart(3, '0')}`;
  }

  async create({
    name,
    email,
    passwordHash,
    firstName,
    lastName,
    phone,
    branchId,
    roleId,
    scopeAllBranches = false,
  }) {
    const pseudoId = await this.nextPseudoId();
    // scopeAllBranches => users.branch_id NULL; nguoc lai => branch_id cu the
    const userBranchId = scopeAllBranches ? null : branchId;

    const result = await query(
      `INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, team_size, status, created_at)
       OUTPUT INSERTED.id
       VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, 0, 'active', GETDATE())`,
      {
        p1: pseudoId,
        p2: name,
        p3: email,
        p4: passwordHash,
        p5: firstName || name,
        p6: lastName || '',
        p7: phone,
        p8: userBranchId,
      }
    );
    const userId = result.recordset[0].id;
    if (roleId) {
      await query('INSERT INTO user_role (user_id, role_id) VALUES (@p1, @p2)', {
        p1: userId,
        p2: roleId,
      });
    }

    return { id: userId, email };
  }

  async updateUser({
    userId,
    firstName,
    lastName,
    email,
    phone,
    status,
    roleId,
    branchId,
    shouldUpdateBranchId = false,
    scopeAllBranches = false,
  }) {
    // Build dynamic UPDATE query
    const updates = [];
    const params = {};
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = @p${paramIndex}`);
      params[`p${paramIndex}`] = firstName;
      paramIndex++;
    }
    if (lastName !== undefined) {
      updates.push(`last_name = @p${paramIndex}`);
      params[`p${paramIndex}`] = lastName;
      paramIndex++;
    }
    if (email !== undefined) {
      updates.push(`email = @p${paramIndex}`);
      params[`p${paramIndex}`] = email;
      paramIndex++;
    }
    if (phone !== undefined) {
      updates.push(`phone = @p${paramIndex}`);
      params[`p${paramIndex}`] = phone || null;
      paramIndex++;
    }
    if (status !== undefined) {
      updates.push(`status = @p${paramIndex}`);
      params[`p${paramIndex}`] = status;
      paramIndex++;
    }
    // Chi update branch_id khi service co gui len (shouldUpdateBranchId === true).
    // scopeAllBranches => NULL; nguoc lai => branchId cu the.
    if (shouldUpdateBranchId) {
      updates.push(`branch_id = @p${paramIndex}`);
      params[`p${paramIndex}`] = scopeAllBranches ? null : branchId;
      paramIndex++;
    }

    if (updates.length > 0) {
      params[`p${paramIndex}`] = userId;
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = @p${paramIndex}`, params);
    }

    if (roleId !== undefined) {
      await query('DELETE FROM user_role WHERE user_id = @p1', { p1: userId });
      if (roleId) {
        await query('INSERT INTO user_role (user_id, role_id) VALUES (@p1, @p2)', {
          p1: userId,
          p2: roleId,
        });
      }
    }

    return this.findById(userId);
  }

  /**
   * Update mat khau user (admin reset password)
   * @param {number} userId - ID user can reset
   * @param {string} passwordHash - mat khau da hash (bcrypt)
   * @returns {Promise<boolean>} true neu update thanh cong
   */
  async updatePassword(userId, passwordHash) {
    const result = await query(
      `UPDATE users
       SET    user_password = @p1
       WHERE  id = @p2`,
      { p1: passwordHash, p2: userId }
    );
    return result.rowsAffected[0] > 0;
  }

  /**
   * Lay thong ke dashboard tong quan
   * Tra ve counts theo status cua users, so branches, so roles
   */
  async getDashboardStats(filters = {}) {
    // YYYY-MM-DD = ngày lịch VN (UTC+7), không phải nửa đêm UTC — tránh "Hôm nay"
    // lúc 00:00–07:00 VN bị trống dù đã có nhật ký (logged_at / login_time là SYSUTCDATETIME).
    const {
      from: fromDate,
      to: rangeEnd,
      hasRange,
    } = parseUtcRangeFromVnDates(filters.fromDate, filters.toDate);

    const [userStats, branchCount, roleCount] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) AS activeCount,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactiveCount
        FROM users
      `),
      query('SELECT COUNT(*) AS total FROM branches WHERE is_active = 1'),
      query('SELECT COUNT(*) AS total FROM roles'),
    ]);

    const users = userStats.recordset[0];

    // Recent audit logs (general activity) — ưu tiên trong khoảng lọc
    let recentLogs = [];
    let periodAuditCount = 0;
    try {
      const logsResult = await query(
        hasRange
          ? `
        SELECT TOP 20
          al.id, al.action, al.user_name, al.table_name, al.entity_name, al.entity_code,
          al.record_id, al.description, al.old_value, al.new_value, al.ip_address,
          al.response_status, al.logged_at
        FROM audit_logs al
        WHERE al.logged_at >= @p1 AND al.logged_at <= @p2
        ORDER BY al.logged_at DESC
      `
          : `
        SELECT TOP 20
          al.id, al.action, al.user_name, al.table_name, al.entity_name, al.entity_code,
          al.record_id, al.description, al.old_value, al.new_value, al.ip_address,
          al.response_status, al.logged_at
        FROM audit_logs al
        ORDER BY al.logged_at DESC
      `,
        hasRange ? { p1: fromDate, p2: rangeEnd } : {}
      );
      recentLogs = logsResult.recordset.map((row) => ({
        id: row.id,
        action: row.action,
        actorName: row.user_name,
        tableName: row.table_name,
        targetType: row.table_name,
        entityName: row.entity_name,
        entityCode: row.entity_code,
        targetId: row.record_id,
        description: row.description,
        oldValue: row.old_value,
        newValue: row.new_value,
        ipAddress: row.ip_address,
        responseStatus: row.response_status,
        createdAt: row.logged_at,
      }));

      if (hasRange) {
        const auditCountRes = await query(
          `SELECT COUNT(*) AS total FROM audit_logs WHERE logged_at >= @p1 AND logged_at <= @p2`,
          { p1: fromDate, p2: rangeEnd }
        );
        periodAuditCount = Number(auditCountRes.recordset[0].total) || 0;
      }
    } catch (_) {
      recentLogs = [];
    }

    let recentLogins = [];
    let todayLogins = 0;
    let failedLogins = 0;
    let recentFailedLogins = 0;
    try {
      const loginResult = await query(
        hasRange
          ? `
        SELECT TOP 24
          ls.id, ls.user_name, ls.action_type, ls.ip_address, ls.user_agent,
          ls.login_time, ls.logout_time, ls.session_duration_seconds, ls.status
        FROM login_sessions ls
        WHERE ls.login_time >= @p1 AND ls.login_time <= @p2
        ORDER BY ls.login_time DESC
      `
          : `
        SELECT TOP 24
          ls.id, ls.user_name, ls.action_type, ls.ip_address, ls.user_agent,
          ls.login_time, ls.logout_time, ls.session_duration_seconds, ls.status
        FROM login_sessions ls
        ORDER BY ls.login_time DESC
      `,
        hasRange ? { p1: fromDate, p2: rangeEnd } : {}
      );
      recentLogins = loginResult.recordset.map((row) => ({
        id: row.id,
        userName: row.user_name,
        actionType: row.action_type,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        loginTime: row.login_time,
        logoutTime: row.logout_time,
        sessionDuration: row.session_duration_seconds,
        status: row.status,
      }));

      const periodStart = hasRange ? fromDate : startOfDayVN(todayYmdVN());
      const periodEnd = hasRange ? rangeEnd : new Date();

      const todayResult = await query(
        `
        SELECT COUNT(*) AS total
        FROM login_sessions
        WHERE action_type = 'LOGIN'
          AND login_time >= @p1 AND login_time <= @p2
      `,
        { p1: periodStart, p2: periodEnd }
      );
      todayLogins = Number(todayResult.recordset[0].total);

      const failedResult = await query(
        `
        SELECT COUNT(*) AS total
        FROM login_sessions
        WHERE action_type = 'LOGIN_FAILED'
          AND login_time >= @p1 AND login_time <= @p2
      `,
        { p1: periodStart, p2: periodEnd }
      );
      failedLogins = Number(failedResult.recordset[0].total);

      const recentFailedResult = await query(`
        SELECT COUNT(*) AS total
        FROM login_sessions
        WHERE action_type = 'LOGIN_FAILED'
          AND login_time >= DATEADD(MINUTE, -15, SYSUTCDATETIME())
      `);
      recentFailedLogins = Number(recentFailedResult.recordset[0].total);
    } catch (_) {
      recentLogins = [];
    }

    let alerts = [];
    let alertCounts = { total: 0, critical: 0, high: 0, medium: 0, info: 0 };
    try {
      const alertsResult = await query(
        hasRange
          ? `
        SELECT TOP 5
          id, severity, title, message, user_id, created_at, rule_key
        FROM (
          SELECT
            id, severity, title, message, user_id, created_at, rule_key,
            ROW_NUMBER() OVER (
              PARTITION BY ISNULL(rule_key, N''),
                CASE WHEN user_id IS NULL THEN 0 ELSE user_id END
              ORDER BY created_at DESC
            ) AS rn
          FROM security_alerts
          WHERE is_acknowledged = 0
            AND created_at >= @p1 AND created_at <= @p2
        ) ranked
        WHERE rn = 1
        ORDER BY
          CASE severity
            WHEN 'critical' THEN 1
            WHEN 'high'     THEN 2
            WHEN 'medium'   THEN 3
            WHEN 'info'     THEN 4
          END ASC,
          created_at DESC
      `
          : `
        SELECT TOP 5
          id, severity, title, message, user_id, created_at, rule_key
        FROM (
          SELECT
            id, severity, title, message, user_id, created_at, rule_key,
            ROW_NUMBER() OVER (
              PARTITION BY ISNULL(rule_key, N''),
                CASE WHEN user_id IS NULL THEN 0 ELSE user_id END
              ORDER BY created_at DESC
            ) AS rn
          FROM security_alerts
          WHERE is_acknowledged = 0
        ) ranked
        WHERE rn = 1
        ORDER BY
          CASE severity
            WHEN 'critical' THEN 1
            WHEN 'high'     THEN 2
            WHEN 'medium'   THEN 3
            WHEN 'info'     THEN 4
          END ASC,
          created_at DESC
      `,
        hasRange ? { p1: fromDate, p2: rangeEnd } : {}
      );
      alerts = alertsResult.recordset.map((row) => ({
        id: String(row.id),
        type:
          row.severity === 'critical'
            ? 'danger'
            : row.severity === 'high'
              ? 'danger'
              : row.severity === 'medium'
                ? 'warning'
                : 'info',
        title: row.title,
        message: row.message,
        severity: row.severity,
        icon:
          row.rule_key === 'failed_login_burst'
            ? 'alert'
            : row.rule_key === 'new_admin_role'
              ? 'shield'
              : row.rule_key === 'inactive_admin'
                ? 'user'
                : row.rule_key === 'session_takeover'
                  ? 'alert'
                  : 'info',
        time: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
        alertId: row.id,
      }));

      const countsResult = await query(
        hasRange
          ? `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN t.severity = 'critical' THEN 1 ELSE 0 END) AS criticalCount,
          SUM(CASE WHEN t.severity = 'high' THEN 1 ELSE 0 END) AS highCount,
          SUM(CASE WHEN t.severity = 'medium' THEN 1 ELSE 0 END) AS mediumCount,
          SUM(CASE WHEN t.severity = 'info' THEN 1 ELSE 0 END) AS infoCount
        FROM (
          SELECT severity,
                 ROW_NUMBER() OVER (
                   PARTITION BY ISNULL(rule_key, N''),
                     CASE WHEN user_id IS NULL THEN 0 ELSE user_id END
                   ORDER BY created_at DESC
                 ) AS rn
          FROM security_alerts
          WHERE is_acknowledged = 0
            AND created_at >= @p1 AND created_at <= @p2
        ) t
        WHERE t.rn = 1
      `
          : `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN t.severity = 'critical' THEN 1 ELSE 0 END) AS criticalCount,
          SUM(CASE WHEN t.severity = 'high' THEN 1 ELSE 0 END) AS highCount,
          SUM(CASE WHEN t.severity = 'medium' THEN 1 ELSE 0 END) AS mediumCount,
          SUM(CASE WHEN t.severity = 'info' THEN 1 ELSE 0 END) AS infoCount
        FROM (
          SELECT severity,
                 ROW_NUMBER() OVER (
                   PARTITION BY ISNULL(rule_key, N''),
                     CASE WHEN user_id IS NULL THEN 0 ELSE user_id END
                   ORDER BY created_at DESC
                 ) AS rn
          FROM security_alerts
          WHERE is_acknowledged = 0
        ) t
        WHERE t.rn = 1
      `,
        hasRange ? { p1: fromDate, p2: rangeEnd } : {}
      );
      const c = countsResult.recordset[0] || {};
      alertCounts = {
        total: Number(c.total) || 0,
        critical: Number(c.criticalCount) || 0,
        high: Number(c.highCount) || 0,
        medium: Number(c.mediumCount) || 0,
        info: Number(c.infoCount) || 0,
      };
    } catch (_) {
      alerts = [];
      alertCounts = { total: 0, critical: 0, high: 0, medium: 0, info: 0 };
    }

    return {
      totalUsers: Number(users.total),
      activeUsers: Number(users.activeCount),
      inactiveUsers: Number(users.inactiveCount),
      lockedUsers: 0,
      totalBranches: Number(branchCount.recordset[0].total),
      totalRoles: Number(roleCount.recordset[0].total),
      recentLogs,
      recentLogins,
      todayLogins,
      failedLogins,
      recentFailedLogins,
      periodAuditCount,
      period: hasRange
        ? { fromDate: fromDate.toISOString(), toDate: rangeEnd.toISOString() }
        : { fromDate: null, toDate: null, preset: 'today' },
      alerts,
      alertCounts,
    };
  }
}

module.exports = AdminUserRepositoryImpl;
