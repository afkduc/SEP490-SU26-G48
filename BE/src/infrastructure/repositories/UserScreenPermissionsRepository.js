const { query, executeTransaction } = require('../database/sqlServer');

/**
 * UserScreenPermissionsRepository - user-level override cua role_screen_permissions.
 *
 * Schema (db/sql/v19_create_user_screen_permissions.sql):
 *   user_screen_permissions(
 *     id BIGINT IDENTITY, user_id BIGINT, screen_key NVARCHAR(120),
 *     can_view BIT, can_create BIT, can_update BIT, can_delete BIT, can_export BIT,
 *     override_type VARCHAR(20),  -- 'grant' | 'deny' | 'full'
 *     granted_by BIGINT, note NVARCHAR(500),
 *     created_at DATETIME2, updated_at DATETIME2,
 *     UNIQUE (user_id, screen_key)
 *   )
 *
 * NOTE: KHONG FK toi users(id) (do type mismatch trong DB hiện tại).
 */
class UserScreenPermissionsRepository {
  /**
   * Lay toan bo override cho 1 user.
   * Returns: Map<screenKey, { canView, canCreate, canUpdate, canDelete, canExport, overrideType, note }>
   */
  async getByUser(userId) {
    if (!userId) return new Map();
    const result = await query(
      `SELECT screen_key, can_view, can_create, can_update, can_delete, can_export,
              override_type, note
       FROM user_screen_permissions
       WHERE user_id = @p1`,
      { p1: userId }
    );
    const map = new Map();
    for (const row of result.recordset) {
      map.set(row.screen_key, {
        canView: Boolean(row.can_view),
        canCreate: Boolean(row.can_create),
        canUpdate: Boolean(row.can_update),
        canDelete: Boolean(row.can_delete),
        canExport: Boolean(row.can_export),
        overrideType: row.override_type,
        note: row.note,
      });
    }
    return map;
  }

  /**
   * Upsert 1 override (không xóa các override khác của user).
   */
  async upsertGrant(userId, item, grantedBy) {
    if (!userId || !item?.screenKey) return { updated: 0 };
    await query(
      `IF EXISTS (SELECT 1 FROM user_screen_permissions WHERE user_id = @p1 AND screen_key = @p2)
         UPDATE user_screen_permissions
         SET can_view = @p3, can_create = @p4, can_update = @p5, can_delete = @p6, can_export = @p7,
             override_type = @p8, granted_by = @p9, note = @p10, updated_at = SYSUTCDATETIME()
         WHERE user_id = @p1 AND screen_key = @p2
       ELSE
         INSERT INTO user_screen_permissions
           (user_id, screen_key, can_view, can_create, can_update, can_delete, can_export,
            override_type, granted_by, note)
         VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10)`,
      {
        p1: userId,
        p2: String(item.screenKey),
        p3: item.canView ? 1 : 0,
        p4: item.canCreate ? 1 : 0,
        p5: item.canUpdate ? 1 : 0,
        p6: item.canDelete ? 1 : 0,
        p7: item.canExport ? 1 : 0,
        p8: String(item.overrideType || 'grant'),
        p9: grantedBy || null,
        p10: item.note || null,
      }
    );
    return { updated: 1 };
  }

  /**
   * Bulk upsert (delete all rows cu -> insert fresh set).
   * Chi dung khi admin thay the TOAN BO override cua user.
   */
  async bulkReplace(userId, items, grantedBy) {
    if (!userId) return { updated: 0 };
    let updated = 0;
    await executeTransaction(async (txQuery) => {
      // Xoa het override cu
      await txQuery(`DELETE FROM user_screen_permissions WHERE user_id = @p1`, { p1: userId });

      // Insert moi (chi insert screen nao co override_type = 'full' hoac it nhat 1 bit = 1)
      const toInsert = items.filter(
        (i) =>
          i.overrideType === 'full' ||
          i.canView || i.canCreate || i.canUpdate || i.canDelete || i.canExport
      );
      for (const it of toInsert) {
        await txQuery(
          `INSERT INTO user_screen_permissions
             (user_id, screen_key, can_view, can_create, can_update, can_delete, can_export,
              override_type, granted_by, note)
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10)`,
          {
            p1: userId,
            p2: String(it.screenKey),
            p3: it.canView ? 1 : 0,
            p4: it.canCreate ? 1 : 0,
            p5: it.canUpdate ? 1 : 0,
            p6: it.canDelete ? 1 : 0,
            p7: it.canExport ? 1 : 0,
            p8: String(it.overrideType || 'full'),
            p9: grantedBy || null,
            p10: it.note || null,
          }
        );
        updated++;
      }
    });
    return { updated };
  }

  /**
   * Xoa toan bo override cua 1 user (quay ve dung role_screen_permissions).
   */
  async clearAll(userId) {
    if (!userId) return 0;
    const result = await query(
      `DELETE FROM user_screen_permissions WHERE user_id = @p1`,
      { p1: userId }
    );
    return result.rowsAffected ? result.rowsAffected[0] : 0;
  }

  /**
   * Lay full permission keys (flat) cho 1 user, ap dung override.
   * Flow:
   *   1. Lay quyen tu role_screen_permissions (theo role cua user).
   *   2. Lay override tu user_screen_permissions.
   *   3. Neu co override_type = 'full' -> DUNG override (bo role).
   *   4. Neu co override_type = 'deny'  -> XOA bit tu role.
   *   5. Neu co override_type = 'grant' -> ADD bit vao role.
   *   6. Neu khong co override -> DUNG role.
   *
   * Tra ve: ['screen:<key>:view', 'screen:<key>:create', ...]
   */
  async getUserScreenPermissions(userId) {
    if (!userId) return [];

    // 1. Role-based permissions
    const roleRows = await query(
      `SELECT rsp.screen_key, rsp.can_view, rsp.can_create, rsp.can_update, rsp.can_delete, rsp.can_export
       FROM role_screen_permissions rsp
       JOIN user_role ur ON ur.role_id = rsp.role_id
       WHERE ur.user_id = @p1`,
      { p1: userId }
    );
    const effective = new Map();
    for (const row of roleRows.recordset) {
      effective.set(row.screen_key, {
        canView: Boolean(row.can_view),
        canCreate: Boolean(row.can_create),
        canUpdate: Boolean(row.can_update),
        canDelete: Boolean(row.can_delete),
        canExport: Boolean(row.can_export),
      });
    }

    // 2. User overrides
    const ovRows = await query(
      `SELECT screen_key, can_view, can_create, can_update, can_delete, can_export, override_type
       FROM user_screen_permissions
       WHERE user_id = @p1`,
      { p1: userId }
    );
    for (const row of ovRows.recordset) {
      const ov = {
        canView: Boolean(row.can_view),
        canCreate: Boolean(row.can_create),
        canUpdate: Boolean(row.can_update),
        canDelete: Boolean(row.can_delete),
        canExport: Boolean(row.can_export),
      };
      const type = row.override_type;
      if (type === 'full') {
        effective.set(row.screen_key, ov);
      } else if (type === 'deny') {
        const existing = effective.get(row.screen_key) || {
          canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false,
        };
        effective.set(row.screen_key, {
          canView: existing.canView && !ov.canView ? false : existing.canView,
          canCreate: existing.canCreate && !ov.canCreate ? false : existing.canCreate,
          canUpdate: existing.canUpdate && !ov.canUpdate ? false : existing.canUpdate,
          canDelete: existing.canDelete && !ov.canDelete ? false : existing.canDelete,
          canExport: existing.canExport && !ov.canExport ? false : existing.canExport,
        });
      } else if (type === 'grant') {
        const existing = effective.get(row.screen_key) || {
          canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false,
        };
        effective.set(row.screen_key, {
          canView: existing.canView || ov.canView,
          canCreate: existing.canCreate || ov.canCreate,
          canUpdate: existing.canUpdate || ov.canUpdate,
          canDelete: existing.canDelete || ov.canDelete,
          canExport: existing.canExport || ov.canExport,
        });
      }
    }

    // 3. Flatten
    const perms = [];
    for (const [key, bits] of effective.entries()) {
      if (bits.canView) perms.push(`screen:${key}:view`);
      if (bits.canCreate) perms.push(`screen:${key}:create`);
      if (bits.canUpdate) perms.push(`screen:${key}:update`);
      if (bits.canDelete) perms.push(`screen:${key}:delete`);
      if (bits.canExport) perms.push(`screen:${key}:export`);
    }
    return perms;
  }
}

module.exports = UserScreenPermissionsRepository;
