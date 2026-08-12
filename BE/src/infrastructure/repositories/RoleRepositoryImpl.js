const { query } = require('../database/sqlServer');

/**
 * Role repository — list/find roles + resolve user permission keys.
 * Ma trận phân quyền (bulk set role_permissions) đã gỡ cùng UI Admin.
 */
class RoleRepositoryImpl {
  /**
   * Lay tat ca roles, kem so luong user trong moi role
   * @returns {Promise<Array<{id, roleName, roleLabel, isActive, userCount}>>}
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
   * Lay permission_key cua user:
   *  - Layer 1: role_permissions (DB)
   *  - Layer 2: default screen:* theo role_name (code map)
   * Wildcard '*' duoc PermissionService.can() check rieng.
   *
   * @param {number} userId
   * @returns {Promise<string[]>}
   */
  async getUserPermissionKeys(userId) {
    const result = await query(`
      SELECT DISTINCT CAST(p.permission_key AS NVARCHAR(500)) COLLATE database_default AS perm_key
      FROM user_role ur
      JOIN roles r ON r.id = ur.role_id AND ISNULL(r.is_active, 1) = 1
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = @p1
        AND ISNULL(ur.is_active, 1) = 1
        AND p.permission_key IS NOT NULL
    `, { p1: userId });

    const fromDb = result.recordset.map((row) => row.perm_key);
    if (fromDb.includes('*')) {
      return fromDb;
    }

    const rolesResult = await query(`
      SELECT DISTINCT LOWER(LTRIM(RTRIM(r.role_name))) AS role_name
      FROM user_role ur
      JOIN roles r ON r.id = ur.role_id AND ISNULL(r.is_active, 1) = 1
      WHERE ur.user_id = @p1
        AND ISNULL(ur.is_active, 1) = 1
        AND r.role_name IS NOT NULL
    `, { p1: userId });

    const roleNames = rolesResult.recordset.map((row) => row.role_name);
    const {
      getDefaultScreenPermissionsForRoles,
    } = require('../../config/defaultScreenPermissionsByRole');
    const fromRoleDefaults = getDefaultScreenPermissionsForRoles(roleNames);

    return [...new Set([...fromDb, ...fromRoleDefaults])];
  }

  /**
   * Permission keys cho JWT.
   * Neu co wildcard '*' thi chi tra ['*'] de tranh JWT qua lon (431).
   *
   * @param {number} userId
   * @returns {Promise<string[]>}
   */
  async getUserPermissionKeysCompact(userId) {
    const star = await query(
      `SELECT TOP 1 p.id
       FROM user_role ur
       JOIN roles r ON r.id = ur.role_id AND ISNULL(r.is_active, 1) = 1
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = @p1
         AND ISNULL(ur.is_active, 1) = 1
         AND p.permission_key = '*'`,
      { p1: userId }
    );
    if (star.recordset.length > 0) {
      return ['*'];
    }

    return this.getUserPermissionKeys(userId);
  }
}

module.exports = RoleRepositoryImpl;
