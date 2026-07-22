const ApiError = require('../../utils/ApiError');
const { auditCrud } = require('../../utils/auditHelper');

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
    if (this.permissionService) {
      const users = await this.roleRepository.getRoleUsers(roleId);
      for (const user of users) {
        this.permissionService.invalidateCache(user.id);
      }
    }

    return this.roleRepository.getRolePermissions(roleId);
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

  /**
   * Xoa role
   */
  async deleteRole(roleId, req = {}) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');

    const protectedRoles = ['admin', 'general_director', 'manager', 'service_advisor', 'team_leader', 'technician', 'warehouse_staff'];
    if (protectedRoles.includes(role.roleName)) {
      throw new ApiError(400, 'Khong the xoa vai tro co san trong he thong');
    }

    const result = await this.roleRepository.delete(roleId);
    if (!result.success) {
      throw new ApiError(409, 'Khong the xoa vai tro dang duoc gan cho nguoi dung');
    }
    await auditCrud.delete(req, {
      tableName: 'roles',
      entityCode: role.roleName,
      recordId: Number(roleId),
      entityName: 'Vai trò',
      oldData: role,
    });
    return { deleted: true, roleId: Number(roleId) };
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
