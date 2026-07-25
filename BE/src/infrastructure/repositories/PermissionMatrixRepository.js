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

  /**
   * Lay tat ca screens (permission_key) lien quan den permission matrix.
   * UNION L1 (screen:*:access + '*') va L2b (role_screen_permissions.screen_key).
   *
   * L2b khong co id tu permissions table, nen tao id ao (-row_number) de
   * FE grantSet lookup `${role.id}_${s.id}` van hoat dong binh thuong.
   * Them field `layer` de FE phan biet (1 = layer 1, 2 = layer 2b).
   *
   * Cau truc output giu nguyen (id, permissionKey, module, resource, action,
   * description, groupKey, groupName, displayOrder) - chi them `layer`.
   */
  async getScreens() {
    const result = await query(`
      SELECT CAST(id AS BIGINT) AS id, permission_key, module, resource, action, description,
             group_id, group_key, group_name, display_order, layer
      FROM (
        -- L1: screen:*:access + '*'
        SELECT
          p.id,
          CAST(p.permission_key AS NVARCHAR(500)) COLLATE database_default AS permission_key,
          CAST(p.module AS NVARCHAR(200)) COLLATE database_default AS module,
          CAST(p.resource AS NVARCHAR(200)) COLLATE database_default AS resource,
          CAST(p.action AS NVARCHAR(50)) COLLATE database_default AS action,
          CAST(p.description AS NVARCHAR(500)) COLLATE database_default AS description,
          pg.id AS group_id,
          pg.group_key,
          pg.group_name,
          pg.display_order,
          CAST(1 AS INT) AS layer
        FROM permissions p
        LEFT JOIN permission_group_items pgi ON pgi.permission_id = p.id
        LEFT JOIN permission_groups pg ON pg.id = pgi.group_id AND pg.is_active = 1
        WHERE p.permission_key LIKE 'screen:%:access'
           OR p.permission_key = '*'

        UNION ALL

        -- L2b: role_screen_permissions (sinh id am de tranh trung L1)
        SELECT
          -ROW_NUMBER() OVER (ORDER BY rsp.screen_key) AS id,
          CAST(rsp.screen_key AS NVARCHAR(500)) COLLATE database_default AS permission_key,
          CAST(CASE
            WHEN CHARINDEX(':', rsp.screen_key) > 0
            THEN LEFT(rsp.screen_key, CHARINDEX(':', rsp.screen_key) - 1)
            ELSE rsp.screen_key
          END AS NVARCHAR(200)) COLLATE database_default AS module,
          CAST(CASE
            WHEN CHARINDEX(':', rsp.screen_key) > 0
            THEN SUBSTRING(rsp.screen_key, CHARINDEX(':', rsp.screen_key) + 1, LEN(rsp.screen_key))
            ELSE N''
          END AS NVARCHAR(200)) COLLATE database_default AS resource,
          CAST(N'view' AS NVARCHAR(50)) COLLATE database_default AS action,
          CAST(rsp.screen_key AS NVARCHAR(500)) COLLATE database_default AS description,
          CAST(NULL AS INT) AS group_id,
          CAST(NULL AS NVARCHAR(100)) COLLATE database_default AS group_key,
          CAST(NULL AS NVARCHAR(200)) COLLATE database_default AS group_name,
          CAST(NULL AS INT) AS display_order,
          CAST(2 AS INT) AS layer
        FROM (SELECT DISTINCT screen_key FROM role_screen_permissions) rsp
      ) AS combined
      ORDER BY
        CASE WHEN permission_key = '*' THEN '___zzz' ELSE module END ASC,
        ISNULL(display_order, 9999) ASC,
        resource ASC,
        action ASC
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
      layer: row.layer,
    }));
  }

  /**
   * Lay grant matrix (role x permission) tu L1 + L2b.
   * Tra ve permissionKey (string) - clean identifier cho FE.
   * permissionId van co de backward compat.
   */
  async getGrants() {
    const result = await query(`
      WITH L2bScreenIds AS (
        SELECT
          CAST(rsp.screen_key AS NVARCHAR(500)) COLLATE database_default AS screen_key,
          -ROW_NUMBER() OVER (ORDER BY rsp.screen_key) AS permission_id
        FROM (SELECT DISTINCT screen_key FROM role_screen_permissions) rsp
      )
      SELECT role_id, permission_id, permission_key, layer
      FROM (
        -- L1 grants
        SELECT
          rp.role_id,
          rp.permission_id,
          CAST(p.permission_key AS NVARCHAR(500)) COLLATE database_default AS permission_key,
          CAST(1 AS INT) AS layer
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE p.permission_key LIKE 'screen:%:access'
           OR p.permission_key = '*'

        UNION ALL

        -- L2b grants: role_screen_permission co it nhat 1 bit = 1 -> grant
        SELECT
          rsp.role_id,
          si.permission_id,
          CAST(rsp.screen_key AS NVARCHAR(500)) COLLATE database_default AS permission_key,
          CAST(2 AS INT) AS layer
        FROM role_screen_permissions rsp
        JOIN L2bScreenIds si
          ON si.screen_key = CAST(rsp.screen_key AS NVARCHAR(500)) COLLATE database_default
        WHERE rsp.can_view = 1 OR rsp.can_create = 1 OR rsp.can_update = 1
           OR rsp.can_delete = 1 OR rsp.can_export = 1
      ) AS combined
    `);
    return result.recordset.map((row) => ({
      roleId: row.role_id,
      permissionId: row.permission_id,
      permissionKey: row.permission_key,
      layer: row.layer,
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
   * Toggle grant bang permissionKey (string) - clean identifier tu API.
   * Resolve permission_key:
   *  - Neu co trong permissions table (Layer 1) -> toggleGrant(roleId, permissionId)
   *  - Neu co trong role_screen_permissions (Layer 2b) -> toggleScreenRoleLayer(roleId, screenKey)
   * Tra ve null neu permissionKey khong ton tai.
   */
  async toggleGrantByKey(roleId, permissionKey, granted) {
    if (!roleId || !permissionKey) return null;
    if (permissionKey === '*') {
      // Wildcard: chi ap dung cho admin (Layer 1)
      const found = await query(
        `SELECT id FROM permissions WHERE permission_key = @p1`,
        { p1: permissionKey }
      );
      if (found.recordset.length === 0) return null;
      const changed = await this.toggleGrant(roleId, found.recordset[0].id, granted);
      return { layer: 1, changed };
    }
    // Thu Layer 1 (permissions table)
    const l1 = await query(
      `SELECT id FROM permissions WHERE permission_key = @p1`,
      { p1: permissionKey }
    );
    if (l1.recordset.length > 0) {
      const changed = await this.toggleGrant(roleId, l1.recordset[0].id, granted);
      return { layer: 1, changed };
    }
    // Thu Layer 2b (role_screen_permissions)
    const l2b = await query(
      `SELECT 1 FROM role_screen_permissions WHERE screen_key = @p1`,
      { p1: permissionKey }
    );
    if (l2b.recordset.length > 0) {
      const changed = await this.toggleScreenRoleLayer(roleId, permissionKey, granted);
      return { layer: 2, changed };
    }
    return null;
  }

  /**
   * Toggle grant cho ca Layer 1 (role_permissions) va Layer 2b (role_screen_permissions).
   * Phan biet theo permissionId:
   *  - > 0: L1 - permissions table
   *  - < 0: L2b - role_screen_permissions, can resolve sang screen_key
   *
   * L2b grant = set 5 bits (can_view/create/update/delete/export) = 1
   * L2b revoke = set ca 5 bits = 0
   */
  async toggleGrantLayered(roleId, permissionId, granted) {
    if (!roleId || permissionId == null) return false;
    if (permissionId > 0) {
      return this.toggleGrant(roleId, permissionId, granted);
    }
    // L2b: resolve permissionId (negative) -> screen_key
    const screenKey = await this.resolveScreenKeyById(permissionId);
    if (!screenKey) return false;
    return this.toggleScreenRoleLayer(roleId, screenKey, granted);
  }

  /**
   * Resolve permissionId (negative) -> screen_key trong role_screen_permissions.
   * Dung ROM_NUMBER() - 1 lam id ao giong getScreens(). Tra ve null neu khong tim thay.
   */
  async resolveScreenKeyById(permissionId) {
    if (permissionId >= 0) return null;
    const result = await query(`
      SELECT screen_key
      FROM (
        SELECT
          rsp.screen_key,
          -ROW_NUMBER() OVER (ORDER BY rsp.screen_key) AS permission_id
        FROM (SELECT DISTINCT screen_key FROM role_screen_permissions) rsp
      ) AS ids
      WHERE permission_id = @p1
    `, { p1: permissionId });
    return result.recordset.length > 0 ? result.recordset[0].screen_key : null;
  }

  /**
   * Upsert role_screen_permissions voi 5 bits = granted ? 1 : 0.
   * Neu row chua ton tai va granted=true -> insert moi voi tat ca bits = 1.
   * Neu row chua ton tai va granted=false -> khong can insert (already none).
   */
  async toggleScreenRoleLayer(roleId, screenKey, granted) {
    if (!roleId || !screenKey) return false;
    const bit = granted ? 1 : 0;
    const check = await query(
      `SELECT 1 FROM role_screen_permissions WHERE role_id = @p1 AND screen_key = @p2`,
      { p1: roleId, p2: screenKey }
    );
    if (check.recordset.length === 0) {
      if (!granted) return false;
      // Insert moi voi 5 bits = 1
      await query(
        `INSERT INTO role_screen_permissions (role_id, screen_key, can_view, can_create, can_update, can_delete, can_export, created_at, updated_at)
         VALUES (@p1, @p2, 1, 1, 1, 1, 1, GETDATE(), GETDATE())`,
        { p1: roleId, p2: screenKey }
      );
      return true;
    }
    // Update: set ca 5 bits
    const result = await query(
      `UPDATE role_screen_permissions
       SET can_view = @p3, can_create = @p3, can_update = @p3,
           can_delete = @p3, can_export = @p3, updated_at = GETDATE()
       WHERE role_id = @p1 AND screen_key = @p2`,
      { p1: roleId, p2: screenKey, p3: bit }
    );
    return result.rowsAffected && result.rowsAffected[0] > 0;
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