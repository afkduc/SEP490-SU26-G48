const { query } = require('../database/sqlServer');

const ADMIN_USER_COLUMNS = `
  u.id,
  u.user_name,
  u.email,
  u.full_name,
  u.phone,
  u.branch_id,
  b.branch_name,
  u.status,
  u.last_login_at,
  u.created_by,
  u.created_at,
  u.updated_at
`;

function toAdminUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.user_name,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    branchId: row.branch_id,
    branchName: row.branch_name,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
        OR u.full_name LIKE @p${paramIndex}
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
        SELECT 1 FROM user_roles ur
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
         FROM   user_roles ur
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
}

module.exports = AdminUserRepositoryImpl;
