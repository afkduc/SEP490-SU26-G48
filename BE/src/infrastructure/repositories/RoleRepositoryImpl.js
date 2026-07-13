const { query } = require('../database/sqlServer');

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
        COUNT(ur.id) AS user_count
      FROM roles r
      LEFT JOIN user_role ur ON ur.role_id = r.id
      GROUP BY r.id, r.role_name, r.role_label
      ORDER BY r.id ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label,
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
        r.role_label
       FROM roles r
       WHERE r.id = @p1`,
      { p1: roleId }
    );
    const row = result.recordset[0];
    if (!row) return null;
    return {
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label,
    };
  }
}

module.exports = RoleRepositoryImpl;
