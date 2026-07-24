const ApiError = require('../../utils/ApiError');
const { auditCrud } = require('../../utils/auditHelper');
const { emitPermissionChanged } = require('../events/PermissionEvents');

const PROTECTED_ROLES = new Set(['admin']);
const CRITICAL_PERMISSION_KEYS = new Set([
  'admin:roles:read',
  'admin:roles:create',
  'admin:roles:update',
  'admin:roles:deactivate',
  'admin:roles:activate',
  'admin:roles:manage',
]);

/**
 * Service cho permission_groups.
 *
 * Luong chinh:
 *   1. Admin mo trang "Roles" -> BE tra ve list groups (gom permissionKeys).
 *   2. Admin tick 1 group cho 1 role -> FE goi PUT /api/admin/roles/:id/groups.
 *   3. Service lay permission_ids cua group -> set vao role_permissions.
 *   4. Invalidate cache affected users + emit SSE permission-changed.
 */
class PermissionGroupService {
  constructor({ groupRepository, permissionService, roleRepository }) {
    this.groupRepository = groupRepository;
    this.permissionService = permissionService;
    this.roleRepository = roleRepository;
  }

  /**
   * GET /api/admin/permission-groups
   * Tra ve tat ca groups kem permission keys, phan nhom theo module.
   */
  async listGroups() {
    const groups = await this.groupRepository.findAllWithItems();
    const byModule = new Map();
    for (const g of groups) {
      if (!byModule.has(g.module)) byModule.set(g.module, []);
      byModule.get(g.module).push(g);
    }
    return {
      items: groups,
      byModule: Object.fromEntries(byModule),
      total: groups.length,
    };
  }

  /**
   * GET /api/admin/permission-groups/:id
   */
  async getGroupDetail(groupId) {
    if (!groupId) throw new ApiError(400, 'groupId la bat buoc');
    const group = await this.groupRepository.findByIdWithItems(Number(groupId));
    if (!group) throw new ApiError(404, 'Permission group khong ton tai');
    return group;
  }

  /**
   * GET /api/admin/roles/:id/groups
   * Tra ve group_ids ma role nay dang co (suy ra tu role_permissions).
   * Frontend dung de hien checkbox da tick.
   */
  async getRoleGroupIds(roleId) {
    if (!roleId) throw new ApiError(400, 'roleId la bat buoc');
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');

    const groupIds = await this.groupRepository.findGroupIdsByRoleId(Number(roleId));
    return { roleId: Number(roleId), groupIds };
  }

  /**
   * PUT /api/admin/roles/:id/groups
   * Body: { groupIds: number[] }
   *
   * Luong:
   *   1. Validate role ton tai
   *   2. Lay permission_ids cua cac group -> merge voi permission_ids hien tai cua role
   *      (union - de khong xoa quyen admin tick rieng le ngoai group)
   *   3. Set role_permissions
   *   4. Invalidate cache + emit SSE
   */
  async setRoleGroups(roleId, groupIds, req = {}) {
    if (!roleId) throw new ApiError(400, 'roleId la bat buoc');
    const numericRoleId = Number(roleId);

    const role = await this.roleRepository.findById(numericRoleId);
    if (!role) throw new ApiError(404, 'Role khong ton tai');

    const ids = Array.isArray(groupIds) ? groupIds.map(Number).filter((id) => Number.isFinite(id) && id > 0) : [];
    const uniqueGroupIds = Array.from(new Set(ids));

    // Lay permission_ids tu cac group moi tick
    const groupPermIds = await this.groupRepository.findPermissionIdsByGroupIds(uniqueGroupIds);

    // Lay permission_ids hien tai cua role (giu lai quyen admin tick rieng le ngoai group)
    const existingPermIds = await this.groupRepository.getRolePermissionIds(numericRoleId);
    const existingSet = new Set(existingPermIds.map(Number));
    const groupPermSet = new Set(groupPermIds.map(Number));

    // Permission chi thuoc group (se bi go neu uncheck group)
    const onlyInGroup = [...existingSet].filter((id) => {
      // id nay co thuoc group nao khac khong? neu chi thuoc group bi uncheck -> go
      return false; // placeholder, xu ly ben duoi
    });

    // Don gian hon: Union (them groupPermIds vao existing, khong xoa gi)
    // Y nghia: tick group = them tat ca quyen trong group; uncheck group = KHONG tu dong go
    // (admin muon go quyen cu the thi can dung matrix chi tiet).
    const finalIds = Array.from(new Set([...existingSet, ...groupPermSet]));

    // Validate last-admin guard neu role la 'admin' va dang bi tuoc critical perm
    await this._guardCriticalPermissions(numericRoleId, finalIds, role.roleName);

    await this.groupRepository.setRolePermissions(numericRoleId, finalIds);

    // Invalidate cache + emit SSE cho cac user dang co role nay
    const affectedUserIds = await this.groupRepository.getUserIdsByRoleId(numericRoleId);
    if (this.permissionService) {
      for (const uid of affectedUserIds) {
        this.permissionService.invalidateCache(uid);
      }
    }
    emitPermissionChanged({
      action: 'role_groups_updated',
      userIds: affectedUserIds,
      roleIds: [numericRoleId],
      actorUserId: req.user?.userId || null,
    });

    // Audit log
    await auditCrud.update(req, {
      tableName: 'role_permissions',
      entityCode: role.roleName,
      recordId: numericRoleId,
      entityName: 'Phan quyen theo nhom',
      data: { groupIds: uniqueGroupIds, permissionCount: finalIds.length },
    }).catch(() => {});

    return {
      roleId: numericRoleId,
      groupIds: uniqueGroupIds,
      permissionCount: finalIds.length,
      affectedUserCount: affectedUserIds.length,
    };
  }

  /**
   * PUT /api/admin/roles/groups/matrix
   * Body: { changes: [{ roleId, groupIds }] }
   * Bulk atomic - dung khi admin luu ca matrix (moi role 1 group list).
   */
  async setRoleGroupsMatrix({ changes }, req = {}) {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new ApiError(400, 'changes la bat buoc va phai co it nhat 1 entry');
    }

    const normalized = [];
    for (const c of changes) {
      const roleId = Number(c.roleId);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        throw new ApiError(400, `roleId khong hop le: ${c.roleId}`);
      }
      const role = await this.roleRepository.findById(roleId);
      if (!role) throw new ApiError(404, `Role khong ton tai: ${roleId}`);

      const groupIds = Array.isArray(c.groupIds)
        ? c.groupIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)
        : [];

      normalized.push({ roleId, roleName: role.roleName, groupIds: Array.from(new Set(groupIds)) });
    }

    // Build final permission_ids cho moi role (union voi existing)
    const txChanges = [];
    for (const { roleId, groupIds } of normalized) {
      const groupPermIds = await this.groupRepository.findPermissionIdsByGroupIds(groupIds);
      const existing = await this.groupRepository.getRolePermissionIds(roleId);
      const merged = Array.from(new Set([...existing.map(Number), ...groupPermIds.map(Number)]));
      txChanges.push({ roleId, permissionIds: merged });
    }

    // Last-admin guard cho role 'admin'
    const adminChange = normalized.find((c) => c.roleName === 'admin');
    if (adminChange) {
      const adminFinal = txChanges.find((c) => c.roleId === adminChange.roleId);
      await this._guardCriticalPermissions(adminChange.roleId, adminFinal.permissionIds, 'admin');
    }

    const diffs = await this.groupRepository.setRolePermissionsMatrixTx(txChanges);

    // Invalidate cache + emit SSE
    const allAffectedUserIds = new Set();
    for (const { roleId } of normalized) {
      const uids = await this.groupRepository.getUserIdsByRoleId(roleId);
      if (this.permissionService) {
        for (const uid of uids) this.permissionService.invalidateCache(uid);
      }
      uids.forEach((uid) => allAffectedUserIds.add(uid));
    }
    emitPermissionChanged({
      action: 'role_groups_matrix_updated',
      userIds: [...allAffectedUserIds],
      roleIds: normalized.map((c) => c.roleId),
      actorUserId: req.user?.userId || null,
    });

    return {
      updatedRoles: normalized.length,
      affectedUserCount: allAffectedUserIds.size,
      diffs,
    };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  /**
   * Guard: khong cho tuoc het critical permissions cua role 'admin'.
   * Neu sau khi set, khong con user nao giu critical perm -> throw 409.
   */
  async _guardCriticalPermissions(roleId, finalPermissionIds, roleName) {
    if (!PROTECTED_ROLES.has(roleName)) return;

    // Lay critical perm keys -> ids
    const criticalResult = await this.roleRepository.getRolePermissions
      ? await this.roleRepository.getRolePermissions(roleId)
      : null;
    // Lay danh sach critical perm_ids tu bang permissions truc tiep (de check final set)
    const allPerms = await this.roleRepository.findAllPermissions();
    const criticalIds = new Set(
      allPerms.filter((p) => CRITICAL_PERMISSION_KEYS.has(p.permissionKey)).map((p) => Number(p.id))
    );
    const finalSet = new Set(finalPermissionIds.map(Number));

    // Neu role 'admin' khong con it nhat 1 critical perm -> refuse
    const stillHasCritical = [...criticalIds].some((id) => finalSet.has(id));
    if (!stillHasCritical) {
      throw new ApiError(
        409,
        `Khong the go het quyen critical cua role 'admin' (tranh lockout he thong)`
      );
    }

    // Dam bao van con user nao giu critical perm
    if (this.roleRepository.countUsersWithPermission) {
      for (const key of CRITICAL_PERMISSION_KEYS) {
        const count = await this.roleRepository.countUsersWithPermission(key);
        if (count < 1) {
          throw new ApiError(
            409,
            `Khong the go quyen '${key}' - se khong con user nao co quyen nay`
          );
        }
      }
    }
  }
}

module.exports = PermissionGroupService;
