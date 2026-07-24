const { query, executeTransaction } = require('../database/sqlServer');

/**
 * Repository cho 2 bang moi:
 *  - dbo.permission_groups
 *  - dbo.permission_group_items
 *
 * Tuong tu RoleRepositoryImpl: dung query() cho read don le,
 * executeTransaction() cho atomic write nhieu role.
 */
class PermissionGroupRepositoryImpl {
  // ============================================================
  // READ
  // ============================================================

  /**
   * Lay tat ca permission_groups, kem permissionKeys (gom tu items).
   * Phan theo module, sort theo display_order.
   *
   * @returns {Promise<Array<{id, groupKey, groupName, groupLabel, module, displayOrder, isActive, permissionKeys: string[]}>>}
   */
  async findAllWithItems() {
    const groupsResult = await query(`
      SELECT
        id,
        group_key,
        group_name,
        group_label,
        module,
        display_order,
        ISNULL(is_active, 1) AS is_active
      FROM dbo.permission_groups
      ORDER BY module ASC, display_order ASC, id ASC
    `);

    const itemsResult = await query(`
      SELECT
        pgi.group_id,
        p.permission_key
      FROM dbo.permission_group_items pgi
      JOIN dbo.permissions p ON p.id = pgi.permission_id
    `);

    // Gom items theo group_id (tranh N+1)
    const itemsByGroup = new Map();
    for (const row of itemsResult.recordset) {
      const gid = Number(row.group_id);
      if (!itemsByGroup.has(gid)) itemsByGroup.set(gid, []);
      itemsByGroup.get(gid).push(row.permission_key);
    }

    return groupsResult.recordset.map((row) => ({
      id: Number(row.id),
      groupKey: row.group_key,
      groupName: row.group_name,
      groupLabel: row.group_label,
      module: row.module,
      displayOrder: Number(row.display_order),
      isActive: Boolean(row.is_active),
      permissionKeys: itemsByGroup.get(Number(row.id)) || [],
    }));
  }

  /**
   * Lay 1 group theo id, kem permissionKeys
   * @returns {Promise<Object|null>}
   */
  async findByIdWithItems(groupId) {
    const groupResult = await query(
      `SELECT
        id,
        group_key,
        group_name,
        group_label,
        module,
        display_order,
        ISNULL(is_active, 1) AS is_active
       FROM dbo.permission_groups
       WHERE id = @p1`,
      { p1: groupId }
    );
    const row = groupResult.recordset[0];
    if (!row) return null;

    const itemsResult = await query(
      `SELECT p.permission_key
       FROM dbo.permission_group_items pgi
       JOIN dbo.permissions p ON p.id = pgi.permission_id
       WHERE pgi.group_id = @p1`,
      { p1: groupId }
    );

    return {
      id: Number(row.id),
      groupKey: row.group_key,
      groupName: row.group_name,
      groupLabel: row.group_label,
      module: row.module,
      displayOrder: Number(row.display_order),
      isActive: Boolean(row.is_active),
      permissionKeys: itemsResult.recordset.map((r) => r.permission_key),
    };
  }

  /**
   * Lay group_id da gan cho 1 role (thong qua group.module mapping).
   *
   * Vi hien tai role gan truc tiep permission_ids (khong qua groups),
   * nen de suy ra group_ids tu role:
   *   groupId duoc gan cho role neu role co >=1 permission thuoc group do.
   *
   * Day la "view" — khong can luu them cot group_id trong role_permissions.
   *
   * @param {number} roleId
   * @returns {Promise<number[]>}
   */
  async findGroupIdsByRoleId(roleId) {
    const result = await query(
      `SELECT DISTINCT pgi.group_id
       FROM dbo.role_permissions rp
       JOIN dbo.permission_group_items pgi ON pgi.permission_id = rp.permission_id
       WHERE rp.role_id = @p1`,
      { p1: roleId }
    );
    return result.recordset.map((row) => Number(row.group_id));
  }

  /**
   * Lay role_permission_ids hien tai (de biet role dang co quyen gi).
   * Sau do merge voi cac permission keys trong groups moi de ra danh sach
   * permission_ids can gan.
   */
  async getRolePermissionIds(roleId) {
    const result = await query(
      `SELECT permission_id
       FROM dbo.role_permissions
       WHERE role_id = @p1`,
      { p1: roleId }
    );
    return result.recordset.map((row) => Number(row.permission_id));
  }

  /**
   * Set permission_ids cho role (xoa cu, insert moi).
   * Day la write don le, khong can transaction vi goi tu service da wrap.
   *
   * @param {number} roleId
   * @param {number[]} permissionIds
   */
  async setRolePermissions(roleId, permissionIds) {
    await query('DELETE FROM dbo.role_permissions WHERE role_id = @p1', { p1: roleId });
    if (!permissionIds || permissionIds.length === 0) return;

    const uniqueIds = Array.from(new Set(permissionIds.map(Number)));
    const values = uniqueIds.map((_, i) => `(@p1, @p${i + 2})`).join(', ');
    const params = { p1: roleId };
    uniqueIds.forEach((pid, i) => { params[`p${i + 2}`] = pid; });

    await query(
      `INSERT INTO dbo.role_permissions (role_id, permission_id) VALUES ${values}`,
      params
    );
  }

  /**
   * Atomic transaction set permissions cho nhieu role (phuc vu matrix save).
   * Tra ve diff {added, removed} cho moi role de audit/SSE.
   *
   * @param {Array<{roleId: number, permissionIds: number[]}>} changes
   * @returns {Promise<Array<{roleId, added: number[], removed: number[]}>>}
   */
  async setRolePermissionsMatrixTx(changes) {
    return executeTransaction(async (txQuery) => {
      const results = [];
      for (const change of changes) {
        const { roleId, permissionIds } = change;
        const beforeResult = await txQuery(
          'SELECT permission_id FROM dbo.role_permissions WHERE role_id = @p1',
          { p1: roleId }
        );
        const beforeIds = new Set(beforeResult.recordset.map((r) => Number(r.permission_id)));
        const afterIds = new Set((permissionIds || []).map(Number));

        const removed = [...beforeIds].filter((id) => !afterIds.has(id));
        const added = [...afterIds].filter((id) => !beforeIds.has(id));

        if (beforeIds.size > 0) {
          await txQuery('DELETE FROM dbo.role_permissions WHERE role_id = @p1', { p1: roleId });
        }
        if (afterIds.size > 0) {
          const ids = [...afterIds];
          const values = ids.map((_, i) => `(@p1, @p${i + 2})`).join(', ');
          const params = { p1: roleId };
          ids.forEach((pid, i) => { params[`p${i + 2}`] = pid; });
          await txQuery(
            `INSERT INTO dbo.role_permissions (role_id, permission_id) VALUES ${values}`,
            params
          );
        }
        results.push({ roleId, added, removed });
      }
      return results;
    });
  }

  /**
   * Lay user IDs dang co role nay (de invalidate cache + emit SSE).
   * @param {number} roleId
   * @returns {Promise<number[]>}
   */
  async getUserIdsByRoleId(roleId) {
    const result = await query(
      `SELECT DISTINCT user_id
       FROM dbo.user_role
       WHERE role_id = @p1
         AND ISNULL(is_active, 1) = 1`,
      { p1: roleId }
    );
    return result.recordset.map((row) => Number(row.user_id));
  }

  /**
   * Validate permission_ids co ton tai trong bang permissions.
   * Tra ve Set cac id hop le (de service so sanh invalid).
   *
   * @param {number[]} permissionIds
   * @returns {Promise<Set<number>>}
   */
  async findValidPermissionIds(permissionIds) {
    if (!permissionIds || permissionIds.length === 0) return new Set();
    const result = await query('SELECT id FROM dbo.permissions');
    const allIds = new Set(result.recordset.map((row) => Number(row.id)));
    return new Set(permissionIds.map(Number).filter((id) => allIds.has(id)));
  }

  /**
   * Lay permission_ids thuoc ve 1 list group_ids.
   * Dung khi user tick group tren matrix -> lay toan bo permission keys cua group
   * -> set vao role_permissions.
   *
   * @param {number[]} groupIds
   * @returns {Promise<number[]>}
   */
  async findPermissionIdsByGroupIds(groupIds) {
    if (!groupIds || groupIds.length === 0) return [];
    const result = await query(
      `SELECT DISTINCT permission_id
       FROM dbo.permission_group_items
       WHERE group_id IN (${groupIds.map((_, i) => `@p${i + 1}`).join(', ')})`,
      Object.fromEntries(groupIds.map((id, i) => [`p${i + 1}`, id]))
    );
    return result.recordset.map((row) => Number(row.permission_id));
  }
}

module.exports = PermissionGroupRepositoryImpl;
