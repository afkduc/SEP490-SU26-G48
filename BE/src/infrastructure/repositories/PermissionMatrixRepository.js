const { query } = require('../database/sqlServer');

/**
 * PermissionMatrixRepository — read/write cho admin permission matrix UI.
 *
 * Tra ve:
 *   - getRoles(): 7 roles (admin + 6 business)
 *   - getScreens(): tat ca screen permission_key (screen:*:access)
 *   - getGrants(roleIds, screenIds): Set `${roleId}_${screenId}` = granted
 *
 * Update:
 *   - toggleGrant(roleId, screenId, granted): insert/delete role_permissions
 *   - invalidateAllCache(): PermissionService.invalidateAllCache()
 */
class PermissionMatrixRepository {
  async getRoles() {
    const result = await query(`
      SELECT
        r.id,
        r.role_name,
        r.role_label,
        ISNULL(r.is_active, 1) AS is_active
      FROM roles r
      WHERE r.role_name IN (
        'admin', 'manager', 'general_director', 'warehouse_staff',
        'service_advisor', 'team_leader', 'technician'
      )
      ORDER BY
        CASE r.role_name
          WHEN 'admin' THEN 1
          WHEN 'manager' THEN 2
          WHEN 'general_director' THEN 3
          WHEN 'warehouse_staff' THEN 4
          WHEN 'service_advisor' THEN 5
          WHEN 'team_leader' THEN 6
          WHEN 'technician' THEN 7
          ELSE 99
        END
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label,
      isActive: Boolean(row.is_active),
    }));
  }

  async getScreens() {
    const result = await query(`
      SELECT
        p.id,
        p.permission_key,
        p.module,
        p.resource,
        p.action,
        p.description,
        pg.id AS group_id,
        pg.group_key,
        pg.group_name,
        pg.display_order
      FROM permissions p
      LEFT JOIN permission_group_items pgi ON pgi.permission_id = p.id
      LEFT JOIN permission_groups pg ON pg.id = pgi.group_id AND pg.is_active = 1
      WHERE p.permission_key LIKE 'screen:%:access'
         OR p.permission_key = '*'
      ORDER BY
        CASE WHEN p.permission_key = '*' THEN '___zzz' ELSE p.module END ASC,
        ISNULL(pg.display_order, 9999) ASC,
        p.resource ASC,
        p.action ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      permissionKey: row.permission_key,
      module: row.module,
      resource: row.resource,
      action: row.action,
      description: row.description,
      groupKey: row.group_key,
      groupName: row.group_name,
      displayOrder: row.display_order == null ? 9999 : Number(row.display_order),
    }));
  }

  async getGrants() {
    const result = await query(`
      SELECT rp.role_id, rp.permission_id
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_key LIKE 'screen:%:access'
         OR p.permission_key = '*'
    `);
    return result.recordset.map((row) => ({
      roleId: row.role_id,
      permissionId: row.permission_id,
    }));
  }

  async grant(roleId, permissionId) {
    if (!roleId || !permissionId) return false;
    const exists = await query(
      'SELECT 1 FROM role_permissions WHERE role_id = @p1 AND permission_id = @p2',
      { p1: roleId, p2: permissionId }
    );
    if (exists.recordset.length > 0) return false;
    await query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES (@p1, @p2)',
      { p1: roleId, p2: permissionId }
    );
    return true;
  }

  async revoke(roleId, permissionId) {
    if (!roleId || !permissionId) return false;
    const result = await query(
      'DELETE FROM role_permissions WHERE role_id = @p1 AND permission_id = @p2',
      { p1: roleId, p2: permissionId }
    );
    return result.rowsAffected && result.rowsAffected[0] > 0;
  }

  async toggleGrant(roleId, permissionId, granted) {
    if (granted) return this.grant(roleId, permissionId);
    return this.revoke(roleId, permissionId);
  }

  /**
   * Lay danh sach userId dang giu role nay (de emit SSE khi admin toggle).
   * Dung trong PermissionMatrixController de push realtime update toi cac
   * user dang online (filter theo userId trong JWT).
   */
  async getUsersByRole(roleId) {
    if (!roleId) return [];
    const result = await query(
      `SELECT DISTINCT ur.user_id AS id
       FROM user_role ur
       WHERE ur.role_id = @p1`,
      { p1: roleId }
    );
    return result.recordset.map((row) => Number(row.id)).filter(Number.isFinite);
  }
}

module.exports = PermissionMatrixRepository;