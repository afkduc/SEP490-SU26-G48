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
        ISNULL(r.is_active, 1) AS is_active,
        COUNT(ur.id) AS user_count
      FROM roles r
      LEFT JOIN user_role ur ON ur.role_id = r.id
      GROUP BY r.id, r.role_name, r.role_label, r.is_active
      ORDER BY r.id ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label,
      isActive: Boolean(row.is_active),
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
        ISNULL(r.is_active, 1) AS is_active
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
      isActive: Boolean(row.is_active),
    };
  }

  /**
   * Kiem tra role_name da ton tai chua
   */
  async findByName(roleName) {
    const result = await query(
      'SELECT id FROM roles WHERE role_name = @p1',
      { p1: roleName }
    );
    return result.recordset[0] || null;
  }

  /**
   * Tao role moi (mac dinh active)
   */
  async create({ roleName, roleLabel }) {
    const result = await query(
      `INSERT INTO roles (role_name, role_label, is_active)
       OUTPUT INSERTED.id
       VALUES (@p1, @p2, 1)`,
      { p1: roleName, p2: roleLabel }
    );
    return result.recordset[0].id;
  }

  /**
   * Cap nhat role
   */
  async update(id, { roleLabel }) {
    await query(
      'UPDATE roles SET role_label = @p2 WHERE id = @p1',
      { p1: id, p2: roleLabel }
    );
    return this.findById(id);
  }

  /**
   * Xoa role (chi xoa neu khong co user_role tham chieu)
   */
  async delete(id) {
    const check = await query(
      'SELECT COUNT(*) AS cnt FROM user_role WHERE role_id = @p1',
      { p1: id }
    );
    if (check.recordset[0].cnt > 0) {
      return { success: false, reason: 'has_users' };
    }
    // Xoa cac role_permissions truoc
    await query('DELETE FROM role_permissions WHERE role_id = @p1', { p1: id });
    await query('DELETE FROM roles WHERE id = @p1', { p1: id });
    return { success: true };
  }

  /**
   * Toggle trang thai active/inactive
   */
  async toggleStatus(id) {
    await query(
      'UPDATE roles SET is_active = CASE WHEN ISNULL(is_active, 1) = 1 THEN 0 ELSE 1 END WHERE id = @p1',
      { p1: id }
    );
    return this.findById(id);
  }

  /**
   * Lay tat ca permissions (phan theo module)
   */
  async findAllPermissions() {
    const result = await query(`
      SELECT id, permission_key, module, resource, action, description
      FROM permissions
      ORDER BY module ASC, action ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      permissionKey: row.permission_key,
      module: row.module,
      resource: row.resource,
      action: row.action,
      description: row.description,
    }));
  }

  /**
   * Lay danh sach permission_ids cua 1 role
   */
  async getRolePermissionIds(roleId) {
    const result = await query(
      'SELECT permission_id FROM role_permissions WHERE role_id = @p1',
      { p1: roleId }
    );
    return result.recordset.map((row) => row.permission_id);
  }

  /**
   * Lay tat ca permissions cua 1 role (join voi permissions table)
   */
  async getRolePermissions(roleId) {
    const result = await query(`
      SELECT p.id, p.permission_key, p.module, p.resource, p.action, p.description
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = @p1
      ORDER BY p.module ASC, p.action ASC
    `, { p1: roleId });
    return result.recordset.map((row) => ({
      id: row.id,
      permissionKey: row.permission_key,
      module: row.module,
      resource: row.resource,
      action: row.action,
      description: row.description,
    }));
  }

  /**
   * Thay doi toan bo permissions cua 1 role
   * @param {number} roleId
   * @param {number[]} permissionIds - mang permission_id moi
   */
  async setRolePermissions(roleId, permissionIds) {
    // Xoa tat ca permission cu
    await query('DELETE FROM role_permissions WHERE role_id = @p1', { p1: roleId });
    // Chen permission moi
    if (permissionIds && permissionIds.length > 0) {
      const values = permissionIds.map((pid, i) => `(@p1, @p${i + 2})`).join(', ');
      const params = { p1: roleId };
      permissionIds.forEach((pid, i) => { params[`p${i + 2}`] = pid; });
      await query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
        params
      );
    }
  }

  /**
   * Lay danh sach user (id, name, email, status) dang co role nay
   */
  async getRoleUsers(roleId) {
    const result = await query(`
      SELECT u.id, u.user_name, u.first_name, u.last_name, u.email, u.status, b.branch_name
      FROM users u
      JOIN user_role ur ON ur.user_id = u.id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE ur.role_id = @p1
      ORDER BY u.user_name ASC
    `, { p1: roleId });
    return result.recordset.map((row) => ({
      id: row.id,
      userName: row.user_name,
      displayName: row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.user_name,
      email: row.email,
      status: row.status,
      branchName: row.branch_name,
    }));
  }
}

module.exports = RoleRepositoryImpl;
