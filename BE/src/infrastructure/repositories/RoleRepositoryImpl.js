const { query, executeTransaction } = require('../database/sqlServer');

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
   * Lay tat ca roles kem permissionIds (dung cho ma tran quyen - tranh N+1 query)
   * @returns {Promise<Array<{id, roleName, roleLabel, isActive, userCount, permissionIds: number[]}>}
   */
  async findAllWithPermissions() {
    const rolesResult = await query(`
      SELECT
        r.id,
        r.role_name,
        r.role_label,
        ISNULL(r.is_active, 1) AS is_active,
        (SELECT COUNT(*) FROM user_role ur WHERE ur.role_id = r.id) AS user_count
      FROM roles r
      ORDER BY r.id ASC
    `);
    const roles = rolesResult.recordset.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label,
      isActive: Boolean(row.is_active),
      userCount: Number(row.user_count),
      permissionIds: [],
    }));

    if (roles.length === 0) return roles;

    const ids = roles.map((r) => r.id);
    const placeholders = ids.map((_, i) => `@p${i + 1}`).join(', ');
    const rpResult = await query(
      `SELECT role_id, permission_id FROM role_permissions WHERE role_id IN (${placeholders})`,
      Object.fromEntries(ids.map((id, i) => [`p${i + 1}`, id]))
    );

    const byRole = new Map();
    for (const row of rpResult.recordset) {
      if (!byRole.has(row.role_id)) byRole.set(row.role_id, []);
      byRole.get(row.role_id).push(row.permission_id);
    }
    for (const role of roles) {
      role.permissionIds = byRole.get(role.id) || [];
    }
    return roles;
  }

  /**
   * Lay permission ID hop le (dung de validate setRolePermissions)
   */
  async findAllPermissionIds() {
    const result = await query(
      `SELECT id FROM permissions`
    );
    return new Set(result.recordset.map((row) => Number(row.id)));
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
   * Lay role theo id, tra ve chi id + role_name (dung cho guard checks).
   * @param {number} roleId
   * @returns {Promise<{id:number, roleName:string}|null>}
   */
  async findRoleLite(roleId) {
    const result = await query(
      'SELECT id, role_name FROM roles WHERE id = @p1',
      { p1: roleId }
    );
    const row = result.recordset[0];
    if (!row) return null;
    return { id: row.id, roleName: row.role_name };
  }

  /**
   * Dem so user dang co 1 permission cu the (qua role_permissions).
   * Dung cho last-admin guard.
   * @param {string} permissionKey
   * @returns {Promise<number>}
   */
  async countUsersWithPermission(permissionKey) {
    const result = await query(`
      SELECT COUNT(DISTINCT ur.user_id) AS cnt
      FROM user_role ur
      JOIN roles r ON r.id = ur.role_id AND ISNULL(r.is_active, 1) = 1
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_key = @p1
        AND ISNULL(ur.is_active, 1) = 1
    `, { p1: permissionKey });
    return Number(result.recordset[0]?.cnt || 0);
  }

  /**
   * Bulk set permissions cho nhieu role trong 1 transaction (atomic).
   * @param {Array<{roleId:number, permissionIds:number[]}>} changes
   * @returns {Promise<{roleId:number, added:number[], removed:number[]}[]>}
   */
  async setRolePermissionsMatrixTx(changes, actorUserId) {
    return executeTransaction(async (txQuery) => {
      const results = [];

      for (const change of changes) {
        const { roleId, permissionIds } = change;

        // Lay permission hien tai
        const beforeResult = await txQuery(
          'SELECT permission_id FROM role_permissions WHERE role_id = @p1',
          { p1: roleId }
        );
        const beforeIds = new Set(beforeResult.recordset.map((r) => Number(r.permission_id)));
        const afterIds = new Set((permissionIds || []).map(Number));

        // Diff
        const removed = [...beforeIds].filter((id) => !afterIds.has(id));
        const added = [...afterIds].filter((id) => !beforeIds.has(id));

        // Xoa cu
        if (beforeIds.size > 0) {
          await txQuery(
            'DELETE FROM role_permissions WHERE role_id = @p1',
            { p1: roleId }
          );
        }

        // Chen moi
        if (afterIds.size > 0) {
          const ids = [...afterIds];
          const values = ids.map((_, i) => `(@p1, @p${i + 2})`).join(', ');
          const params = { p1: roleId };
          ids.forEach((pid, i) => { params[`p${i + 2}`] = pid; });
          await txQuery(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
            params
          );
        }

        results.push({ roleId, added, removed });
      }

      return results;
    });
  }

  /**
   * Lay tat ca permission_key strings cua 1 user (dùng cho RBAC enforcement).
   * Chỉ lấy roles đang active (is_active = 1) và permissions của các role đó.
   * @param {number} userId
   * @returns {Promise<string[]>}
   */
  async getUserPermissionKeys(userId) {
    const result = await query(`
      SELECT DISTINCT p.permission_key
      FROM user_role ur
      JOIN roles r ON r.id = ur.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = @p1
        AND ISNULL(ur.is_active, 1) = 1
        AND ISNULL(r.is_active, 1) = 1
    `, { p1: userId });
    return result.recordset.map((row) => row.permission_key);
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
