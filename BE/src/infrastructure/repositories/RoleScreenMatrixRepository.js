const { query, executeTransaction } = require('../database/sqlServer');

/**
 * RoleScreenMatrixRepository - đọc/ghi bảng role_screen_permissions.
 *
 * Schema (khop voi DB hien tai):
 *   role_screen_permissions(
 *     id INT IDENTITY, role_id BIGINT, screen_key VARCHAR(100),
 *     can_view BIT, can_create BIT, can_update BIT, can_delete BIT, can_export BIT,
 *     created_at DATETIME2, updated_at DATETIME2,
 *     FK role_id -> roles(id)
 *   )
 *
 * Screen_key = "module:resource" (vd: "manager:services", "director:reports").
 */
class RoleScreenMatrixRepository {
  /**
   * Lay danh sach screens (module:resource) da duoc define trong matrix
   * cho role cu the (gop admin + business).
   */
  async getScreenKeys() {
    const result = await query(`
      SELECT DISTINCT screen_key
      FROM role_screen_permissions
      ORDER BY screen_key
    `);
    return result.recordset.map((r) => r.screen_key);
  }

  /**
   * Lay toan bo matrix cua 1 role.
   * Returns: Map<screenKey, { canView, canCreate, canUpdate, canDelete, canExport }>
   */
  async getMatrixByRole(roleId) {
    if (!roleId) return new Map();
    const result = await query(
      `SELECT screen_key, can_view, can_create, can_update, can_delete, can_export
       FROM role_screen_permissions
       WHERE role_id = @p1`,
      { p1: roleId }
    );
    const map = new Map();
    for (const row of result.recordset) {
      map.set(row.screen_key, {
        canView: Boolean(row.can_view),
        canCreate: Boolean(row.can_create),
        canUpdate: Boolean(row.can_update),
        canDelete: Boolean(row.can_delete),
        canExport: Boolean(row.can_export),
      });
    }
    return map;
  }

  /**
   * Lay matrix tuong doi giua nhieu role (de so sanh/view).
   * Returns: { screens: [..], grants: { roleId: { screenKey: {canView,..} } } }
   */
  async getMatrixForRoles(roleIds) {
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return { screens: [], grants: {} };
    }
    const inClause = roleIds.map((_, i) => `@p${i + 1}`).join(',');
    const result = await query(
      `SELECT role_id, screen_key, can_view, can_create, can_update, can_delete, can_export
       FROM role_screen_permissions
       WHERE role_id IN (${inClause})`,
      Object.fromEntries(roleIds.map((id, i) => [`p${i + 1}`, id]))
    );
    const screens = new Set();
    const grants = {};
    for (const row of result.recordset) {
      screens.add(row.screen_key);
      const rid = String(row.role_id);
      if (!grants[rid]) grants[rid] = {};
      grants[rid][row.screen_key] = {
        canView: Boolean(row.can_view),
        canCreate: Boolean(row.can_create),
        canUpdate: Boolean(row.can_update),
        canDelete: Boolean(row.can_delete),
        canExport: Boolean(row.can_export),
      };
    }
    return { screens: Array.from(screens).sort(), grants };
  }

  /**
   * Upsert 1 row (role_id, screen_key, 5 bits).
   */
  async upsert(roleId, screenKey, bits) {
    if (!roleId || !screenKey) return false;
    const result = await query(
      `IF EXISTS (SELECT 1 FROM role_screen_permissions WHERE role_id = @p1 AND screen_key = @p2)
        UPDATE role_screen_permissions
        SET can_view = @p3, can_create = @p4, can_update = @p5,
            can_delete = @p6, can_export = @p7, updated_at = GETDATE()
        WHERE role_id = @p1 AND screen_key = @p2;
      ELSE
        INSERT INTO role_screen_permissions (role_id, screen_key, can_view, can_create, can_update, can_delete, can_export)
        VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7);`,
      {
        p1: roleId,
        p2: screenKey,
        p3: bits.canView ? 1 : 0,
        p4: bits.canCreate ? 1 : 0,
        p5: bits.canUpdate ? 1 : 0,
        p6: bits.canDelete ? 1 : 0,
        p7: bits.canExport ? 1 : 0,
      }
    );
    return result.rowsAffected && result.rowsAffected[0] > 0;
  }

  /**
   * Bulk upsert trong 1 transaction (admin save whole matrix).
   * items: [{ roleId, screenKey, canView, canCreate, canUpdate, canDelete, canExport }]
   */
  async bulkUpsert(items) {
    if (!Array.isArray(items) || items.length === 0) return { updated: 0 };

    let updated = 0;
    await executeTransaction(async (txQuery) => {
      for (const item of items) {
        const result = await txQuery(
          `IF EXISTS (SELECT 1 FROM role_screen_permissions WHERE role_id = @p1 AND screen_key = @p2)
            UPDATE role_screen_permissions
            SET can_view = @p3, can_create = @p4, can_update = @p5,
                can_delete = @p6, can_export = @p7, updated_at = GETDATE()
            WHERE role_id = @p1 AND screen_key = @p2;
          ELSE
            INSERT INTO role_screen_permissions (role_id, screen_key, can_view, can_create, can_update, can_delete, can_export)
            VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7);`,
          {
            p1: item.roleId,
            p2: item.screenKey,
            p3: item.canView ? 1 : 0,
            p4: item.canCreate ? 1 : 0,
            p5: item.canUpdate ? 1 : 0,
            p6: item.canDelete ? 1 : 0,
            p7: item.canExport ? 1 : 0,
          }
        );
        if (result.rowsAffected && result.rowsAffected[0] > 0) updated++;
      }
    });
    return { updated };
  }

  /**
   * Lay user_ids dang giu role (de invalidate cache + emit SSE).
   */
  async getUsersByRole(roleId) {
    if (!roleId) return [];
    const result = await query(
      `SELECT DISTINCT ur.user_id AS id
       FROM user_role ur
       WHERE ur.role_id = @p1`,
      { p1: roleId }
    );
    return result.recordset.map((r) => Number(r.id)).filter(Number.isFinite);
  }

  /**
   * Lay full permission keys (flat) cho 1 user, từ role_screen_permissions.
   * Format: "screen:<screen_key>:<action>" where action in {view, create, update, delete, export}
   *
   * Vi du:
   *   role_screen_permissions[role_id=manager, screen='manager:services', can_view=1]
   *   -> emit permission "screen:manager:services:view"
   */
  async getUserScreenPermissions(userId) {
    if (!userId) return [];
    const result = await query(
      `SELECT rsp.screen_key, rsp.can_view, rsp.can_create, rsp.can_update, rsp.can_delete, rsp.can_export
       FROM role_screen_permissions rsp
       JOIN user_role ur ON ur.role_id = rsp.role_id
       WHERE ur.user_id = @p1`,
      { p1: userId }
    );
    const perms = [];
    for (const row of result.recordset) {
      const key = row.screen_key;
      if (row.can_view) perms.push(`screen:${key}:view`);
      if (row.can_create) perms.push(`screen:${key}:create`);
      if (row.can_update) perms.push(`screen:${key}:update`);
      if (row.can_delete) perms.push(`screen:${key}:delete`);
      if (row.can_export) perms.push(`screen:${key}:export`);
    }
    return perms;
  }
}

module.exports = RoleScreenMatrixRepository;
