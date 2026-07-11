const { query } = require('../database/sqlServer');

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
  u.created_at
`;

function toAdminUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.user_name,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    branchId: row.branch_id,
    branchName: row.branch_name,
    status: row.status,
    createdAt: row.created_at,
    roles: [],
  };
}

class AdminUserRepositoryImpl {
  async findAll({ search, branchId, roleId, status, page = 1, pageSize = 10 }) {
    const conditions = ['1=1'];
    const params = {};
    let paramIndex = 1;

    if (search) {
      conditions.push(`(
        u.user_name LIKE @p${paramIndex}
        OR u.email LIKE @p${paramIndex}
        OR u.first_name LIKE @p${paramIndex}
        OR u.last_name LIKE @p${paramIndex}
      )`);
      params[`p${paramIndex}`] = `%${search}%`;
      paramIndex++;
    }

    if (branchId) {
      conditions.push(`u.branch_id = @p${paramIndex}`);
      params[`p${paramIndex}`] = branchId;
      paramIndex++;
    }

    if (roleId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM user_role ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.role_name = @p${paramIndex}
      )`);
      params[`p${paramIndex}`] = roleId;
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

    // Lay roles cho tung user
    if (users.length > 0) {
      const userIds = users.map((u) => u.id);
      const rolesResult = await query(
        `SELECT ur.user_id, r.role_name
         FROM   user_role ur
         JOIN   roles r ON r.id = ur.role_id
         WHERE  ur.user_id IN (${userIds.map((_, i) => `@p${paramIndex + i}`).join(',')})`,
        Object.fromEntries(userIds.map((id, i) => [`p${paramIndex + i}`, id]))
      );
      const rolesByUser = {};
      for (const row of rolesResult.recordset) {
        if (!rolesByUser[row.user_id]) rolesByUser[row.user_id] = [];
        rolesByUser[row.user_id].push(row.role_name);
      }
      for (const user of users) {
        user.roles = rolesByUser[user.id] || [];
      }
    }

    return { items: users, total, page, pageSize };
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
      `SELECT r.role_name
       FROM   user_role ur
       JOIN   roles r ON r.id = ur.role_id
       WHERE  ur.user_id = @p1`,
      { p1: id }
    );
    user.roles = rolesResult.recordset.map((r) => r.role_name);
    return user;
  }

  async findByEmail(email) {
    const result = await query(
      'SELECT TOP 1 id, email FROM users WHERE email = @p1',
      { p1: email }
    );
    return result.recordset[0] || null;
  }

  async create({ name, email, passwordHash, firstName, lastName, phone, branchId, roleId }) {
    const result = await query(
      `INSERT INTO users (user_name, email, user_password, first_name, last_name, phone, branch_id, status)
       OUTPUT INSERTED.id
       VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, 'active')`,
      { p1: name, p2: email, p3: passwordHash, p4: firstName || name, p5: lastName || '', p6: phone, p7: branchId }
    );
    const userId = result.recordset[0].id;
    if (roleId) {
      await query(
        'INSERT INTO user_role (user_id, role_id) VALUES (@p1, @p2)',
        { p1: userId, p2: roleId }
      );
    }
    return { id: userId, email };
  }

  async updateUser({ userId, status, roleId }) {
    const updates = [];
    const params = {};
    let p = 1;

    if (status !== undefined) {
      updates.push(`status = @p${p}`);
      params[`p${p}`] = status;
      p++;
    }

    if (updates.length > 0) {
      params[`p${p}`] = userId;
      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = @p${p}`,
        params
      );
    }

    if (roleId !== undefined) {
      await query('DELETE FROM user_role WHERE user_id = @p1', { p1: userId });
      if (roleId) {
        await query(
          'INSERT INTO user_role (user_id, role_id) VALUES (@p1, @p2)',
          { p1: userId, p2: roleId }
        );
      }
    }

    return this.findById(userId);
  }

  /**
   * Lay thong ke dashboard tong quan
   * Tra ve counts theo status cua users, so branches, so roles
   * Neu bang system_logs chua ton tai thi recentLogs tra ve []
   */
  async getDashboardStats() {
    const [userStats, branchCount, roleCount] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) AS activeCount,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactiveCount,
          SUM(CASE WHEN status = 'locked'   THEN 1 ELSE 0 END) AS lockedCount
        FROM users
      `),
      query('SELECT COUNT(*) AS total FROM branches WHERE is_active = 1'),
      query('SELECT COUNT(*) AS total FROM roles'),
    ]);

    const users = userStats.recordset[0];
    let recentLogs = [];

    try {
      const logsResult = await query(`
        SELECT TOP 5
          sl.id,
          sl.action,
          sl.actor_name,
          sl.target_type,
          sl.target_id,
          sl.details,
          sl.ip_address,
          sl.created_at
        FROM system_logs sl
        ORDER BY sl.created_at DESC
      `);
      recentLogs = logsResult.recordset.map((row) => ({
        id: row.id,
        action: row.action,
        actorName: row.actor_name,
        targetType: row.target_type,
        targetId: row.target_id,
        details: row.details,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
      }));
    } catch (_) {
      recentLogs = [];
    }

    return {
      totalUsers: Number(users.total),
      activeUsers: Number(users.activeCount),
      inactiveUsers: Number(users.inactiveCount),
      lockedUsers: Number(users.lockedCount),
      totalBranches: Number(branchCount.recordset[0].total),
      totalRoles: Number(roleCount.recordset[0].total),
      recentLogs,
    };
  }
}

module.exports = AdminUserRepositoryImpl;
