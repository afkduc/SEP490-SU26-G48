const { query } = require('../../database/sqlServer');

class UserRoleRepositoryImpl {
  /**
   * Lay danh sach role cua 1 user
   * @param {number} userId
   * @returns {Promise<Array<{id, roleId, roleName, roleLabel}>>}
   */
  async findByUser(userId) {
    const result = await query(
      `SELECT
        ur.id,
        ur.role_id,
        r.role_name,
        r.role_label
       FROM user_role ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = @p1`,
      { p1: userId }
    );
    return result.recordset.map((row) => ({
      id: row.id,
      roleId: row.role_id,
      roleName: row.role_name,
      roleLabel: row.role_label,
    }));
  }

  /**
   * Gan 1 role cho user (insert vao user_role)
   * Neu da ton tai thi khong lam gi
   * @param {number} userId
   * @param {number} roleId
   */
  async assignRole(userId, roleId) {
    const existing = await query(
      'SELECT id FROM user_role WHERE user_id = @p1 AND role_id = @p2',
      { p1: userId, p2: roleId }
    );
    if (existing.recordset.length > 0) return; // da ton tai
    await query(
      'INSERT INTO user_role (user_id, role_id) VALUES (@p1, @p2)',
      { p1: userId, p2: roleId }
    );
  }

  /**
   * Xoa 1 role khoi user
   * @param {number} userId
   * @param {number} roleId
   */
  async removeRole(userId, roleId) {
    await query(
      'DELETE FROM user_role WHERE user_id = @p1 AND role_id = @p2',
      { p1: userId, p2: roleId }
    );
  }

  /**
   * Xoa toan bo role cua user
   * @param {number} userId
   */
  async removeAllRoles(userId) {
    await query('DELETE FROM user_role WHERE user_id = @p1', { p1: userId });
  }

  /**
   * Kiem tra user co role nay khong
   * @param {number} userId
   * @param {number} roleId
   * @returns {Promise<boolean>}
   */
  async hasRole(userId, roleId) {
    const result = await query(
      'SELECT id FROM user_role WHERE user_id = @p1 AND role_id = @p2',
      { p1: userId, p2: roleId }
    );
    return result.recordset.length > 0;
  }
}

module.exports = UserRoleRepositoryImpl;
