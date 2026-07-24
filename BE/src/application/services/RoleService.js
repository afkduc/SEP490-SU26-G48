const ApiError = require('../../utils/ApiError');
const { auditCrud } = require('../../utils/auditHelper');
const { emitPermissionChanged } = require('../events/PermissionEvents');

// Constants cho last-admin guard
// Khoa cung role 'admin' khong bao gio duoc phep bi tuoc het 'admin:roles:*'
// (tranh lockout toan he thong).
const PROTECTED_ROLES = new Set(['admin']);
const CRITICAL_PERMISSION_KEYS = new Set([
  'admin:roles:read',
  'admin:roles:create',
  'admin:roles:update',
  'admin:roles:deactivate',
  'admin:roles:activate',
  'admin:roles:manage',
]);

class RoleService {
  constructor({ roleRepository, permissionService }) {
    this.roleRepository = roleRepository;
    this.permissionService = permissionService;
  }

  async listRoles() {
    const roles = await this.roleRepository.findAll();
    return { items: roles, total: roles.length };
  }

  /**
   * Lay roles kem permissionIds trong 1 call (phuc vu ma tran quyen - tranh N+1)
   */
  async listRolesWithPermissions() {
    const roles = await this.roleRepository.findAllWithPermissions();
    return { items: roles, total: roles.length };
  }

  async getRoleDetail(roleId) {
    if (!roleId) throw new ApiError(400, 'roleId la bat buoc');
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');
    return role;
  }

  /**
   * Lay tat ca permissions (phan theo module)
   */
  async listPermissions() {
    return this.roleRepository.findAllPermissions();
  }

  /**
   * Lay permissions cua 1 role
   */
  async getRolePermissions(roleId) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');
    return this.roleRepository.getRolePermissions(roleId);
  }

  /**
   * Gan permissions cho 1 role
   * Validate permission IDs ton tai truoc khi gan (tranh FK constraint fail)
   */
  async setRolePermissions(roleId, permissionIds) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');

    // Validate: permissionIds phai la mang number va cac ID phai ton tai
    const ids = (permissionIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length > 0) {
      const validIds = await this.roleRepository.findAllPermissionIds();
      const invalidIds = uniqueIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        throw new ApiError(400, `Permission ID khong ton tai: ${invalidIds.join(', ')}`);
      }
    }

    await this.roleRepository.setRolePermissions(roleId, uniqueIds);

    // Invalidate cache cho tat ca users có role này
    const affectedUserIds = new Set();
    if (this.permissionService) {
      const users = await this.roleRepository.getRoleUsers(roleId);
      for (const user of users) {
        this.permissionService.invalidateCache(user.id);
        affectedUserIds.add(user.id);
      }
    }

    // Emit SSE event de FE refresh permission ngay (khong can F5/logout)
    emitPermissionChanged({
      action: 'matrix_updated',
      userIds: [...affectedUserIds],
      roleIds: [roleId],
    });

    return this.roleRepository.getRolePermissions(roleId);
  }

  /**
   * Bulk set permissions cho nhieu role trong 1 transaction (atomic).
   * Bao gom:
   *  - Validate input
   *  - Last-admin guard: khong cho phep tuoc het admin:roles:* cua role admin
   *  - 1 transaction cho tat ca changes (atomic — fail = rollback het)
   *  - Invalidate permission cache cua tat ca users bi anh huong
   *
   * @param {{changes: Array<{roleId:number, permissionIds:number[]}>, actorUserId:number}} input
   * @returns {Promise<{results: Array<{roleId:number, added:number[], removed:number[]}>, invalidations: number, affectedUserIds: number[]}>}
   */
  async setRolePermissionsMatrix({ changes, actorUserId }) {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new ApiError(400, 'changes phai la mang khong rong');
    }

    // Normalize + validate input
    const normalized = [];
    for (const c of changes) {
      if (!c || typeof c.roleId !== 'number' && typeof c.roleId !== 'string') {
        throw new ApiError(400, 'Moi change phai co roleId (number)');
      }
      const roleId = Number(c.roleId);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        throw new ApiError(400, `roleId khong hop le: ${c.roleId}`);
      }
      const ids = Array.isArray(c.permissionIds) ? c.permissionIds : [];
      const uniqueIds = Array.from(
        new Set(
          ids
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );
      normalized.push({ roleId, permissionIds: uniqueIds });
    }

    // Validate role ton tai + validate permission IDs ton tai (1 query batch)
    const validRoleIds = new Set();
    for (const { roleId } of normalized) {
      const r = await this.roleRepository.findRoleLite(roleId);
      if (!r) throw new ApiError(404, `Role khong ton tai: ID ${roleId}`);
      validRoleIds.add(r.roleName);
    }

    const allIds = new Set();
    for (const { permissionIds } of normalized) {
      permissionIds.forEach((id) => allIds.add(id));
    }
    if (allIds.size > 0) {
      const validPermIds = await this.roleRepository.findAllPermissionIds();
      const invalid = [...allIds].filter((id) => !validPermIds.has(id));
      if (invalid.length > 0) {
        throw new ApiError(400, `Permission ID khong ton tai: ${invalid.join(', ')}`);
      }
    }

    // LAST-ADMIN GUARD: kiem tra neu thay doi role 'admin' ma lam mat
    // toan bo critical permissions (admin:roles:*) -> check con user nao giu khong
    for (const { roleId, permissionIds } of normalized) {
      const role = await this.roleRepository.findRoleLite(roleId);
      if (!PROTECTED_ROLES.has(role.roleName)) continue;

      // Lay permission keys hien tai cua role admin
      const currentPermsResult = await this.roleRepository.getRolePermissions(roleId);
      const currentPermKeys = new Set(currentPermsResult.map((p) => p.permissionKey));

      // Map permission IDs trong request -> permission keys
      const allPerms = await this.roleRepository.findAllPermissions();
      const idToKey = new Map(allPerms.map((p) => [p.id, p.permissionKey]));
      const requestedPermKeys = new Set(
        permissionIds.map((id) => idToKey.get(id)).filter(Boolean)
      );

      // Check: những critical permission key nào đang có mà sẽ bị mất?
      const losingCritical = [...CRITICAL_PERMISSION_KEYS].filter(
        (k) => currentPermKeys.has(k) && !requestedPermKeys.has(k)
      );

      if (losingCritical.length > 0) {
        // Dem user con lai co it nhat 1 critical permission
        let remaining = 0;
        for (const k of losingCritical) {
          const cnt = await this.roleRepository.countUsersWithPermission(k);
          if (cnt > remaining) remaining = cnt;
        }
        if (remaining === 0) {
          throw new ApiError(
            409,
            `Khong the tuoc het quyen admin:roles:* cua role "admin" (se khoa toan he thong). Can it nhat 1 user khac dang giu quyen tuong tu.`
          );
        }
      }
    }

    // Atomic transaction: tat ca changes thanh cong hoac tat ca rollback
    const results = await this.roleRepository.setRolePermissionsMatrixTx(
      normalized,
      actorUserId
    );

    // Invalidate cache cho users cua cac role bi anh huong
    let invalidations = 0;
    const affectedUserIds = new Set();
    if (this.permissionService) {
      for (const { roleId } of normalized) {
        try {
          const users = await this.roleRepository.getRoleUsers(roleId);
          for (const user of users) {
            this.permissionService.invalidateCache(user.id);
            invalidations++;
            affectedUserIds.add(user.id);
          }
        } catch (_) {
          // best-effort, khong fail ca bulk neu 1 role khong co users
        }
      }
    }

    // Emit SSE event de push permission-changed toi cac user dang online
    // (filter theo userId o SSE route). Frontend nhan event -> refresh token.
    emitPermissionChanged({
      action: 'matrix_updated',
      userIds: [...affectedUserIds],
      roleIds: normalized.map((c) => c.roleId),
      actorUserId,
    });

    return {
      results,
      invalidations,
      affectedUserIds: [...affectedUserIds],
    };
  }

  /**
   * Lay danh sach user dang co role
   */
  async getRoleUsers(roleId) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');
    return this.roleRepository.getRoleUsers(roleId);
  }

  /**
   * Tao role moi
   */
  async createRole({ roleName, roleLabel }, req = {}) {
    if (!roleName || !roleName.trim()) {
      throw new ApiError(400, 'roleName la bat buoc');
    }
    if (!roleLabel || !roleLabel.trim()) {
      throw new ApiError(400, 'roleLabel la bat buoc');
    }

    const slug = roleName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (slug.length < 2) {
      throw new ApiError(400, 'roleName phai co it nhat 2 ky tu (chi chu cai va so)');
    }

    const existed = await this.roleRepository.findByName(slug);
    if (existed) {
      throw new ApiError(409, 'Ten vai tro da ton tai');
    }

    const id = await this.roleRepository.create({ roleName: slug, roleLabel: roleLabel.trim() });
    const role = await this.roleRepository.findById(id);
    await auditCrud.create(req, {
      tableName: 'roles',
      entityCode: slug,
      recordId: id,
      entityName: 'Vai trò',
      data: { roleName: slug, roleLabel: roleLabel.trim() },
    });
    return role;
  }

  /**
   * Cap nhat role
   */
  async updateRole(roleId, { roleLabel }, req = {}) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');

    if (!roleLabel || !roleLabel.trim()) {
      throw new ApiError(400, 'roleLabel khong duoc rong');
    }

    const updated = await this.roleRepository.update(roleId, { roleLabel: roleLabel.trim() });
    await auditCrud.update(req, {
      tableName: 'roles',
      entityCode: role.roleName,
      recordId: Number(roleId),
      entityName: 'Vai trò',
      oldData: role,
      newData: { roleLabel: roleLabel.trim() },
    });
    return updated;
  }

  async toggleStatus(roleId, req = {}) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');
    const updated = await this.roleRepository.toggleStatus(roleId);
    await auditCrud.update(req, {
      tableName: 'roles',
      entityCode: role.roleName,
      recordId: Number(roleId),
      entityName: 'Vai trò',
      oldData: { ...role, isActive: role.isActive },
      newData: { isActive: updated.isActive },
      description: updated.isActive
        ? `Kích hoạt vai trò "${role.roleName}"`
        : `Vô hiệu hóa vai trò "${role.roleName}"`,
    });
    return updated;
  }
}

module.exports = RoleService;
