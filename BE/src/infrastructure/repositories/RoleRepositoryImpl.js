const { query } = require('../../database/sqlServer');

class RoleRepositoryImpl {
  /**
   * Lay tat ca roles, kem so luong user trong moi role
   * @returns {Promise<Array<{id, roleName, roleLabel, description, userCount}>>}
   */
  async findAll() {
    const result = await query(`
      SELECT
        r.id,
        r.role_name,
        r.role_label,
        r.description,
        r.is_active,
        r.created_at,
        COUNT(ur.id) AS user_count
      FROM roles r
      LEFT JOIN user_role ur ON ur.role_id = r.id
      GROUP BY r.id, r.role_name, r.role_label, r.description, r.is_active, r.created_at
      ORDER BY r.id ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      userCount: Number(row.user_count),
    }));
  }

  /**
   * Lay chi tiet 1 role theo id
   * @param {number} roleId
   * @returns {Promise<Object|null>}
   */
  async findById(roleId) {
    const result = await query(
      `SELECT
        r.id,
        r.role_name,
        r.role_label,
        r.description,
        r.is_active,
        r.created_at,
        COUNT(ur.id) AS user_count
       FROM roles r
       LEFT JOIN user_role ur ON ur.role_id = r.id
       WHERE r.id = @p1
       GROUP BY r.id, r.role_name, r.role_label, r.description, r.is_active, r.created_at`,
      { p1: roleId }
    );
    const row = result.recordset[0];
    if (!row) return null;
    return {
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      userCount: Number(row.user_count),
    };
  }
}

module.exports = RoleRepositoryImpl;
