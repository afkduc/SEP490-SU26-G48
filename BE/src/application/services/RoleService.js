const ApiError = require('../../utils/ApiError');

class RoleService {
  constructor({ roleRepository, permissionService }) {
    this.roleRepository = roleRepository;
    this.permissionService = permissionService;
  }

  async listRoles() {
    const roles = await this.roleRepository.findAll();
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
   */
  async setRolePermissions(roleId, permissionIds) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');
    await this.roleRepository.setRolePermissions(roleId, permissionIds);

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
  async createRole({ roleName, roleLabel }) {
    if (!roleName || !roleName.trim()) {
      throw new ApiError(400, 'roleName la bat buoc');
    }
    if (!roleLabel || !roleLabel.trim()) {
      throw new ApiError(400, 'roleLabel la bat buoc');
    }

    // roleName format: lowercase, khong dau, underscore
    const slug = roleName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (slug.length < 2) {
      throw new ApiError(400, 'roleName phai co it nhat 2 ky tu (chi chu cai va so)');
    }

    const existed = await this.roleRepository.findByName(slug);
    if (existed) {
      throw new ApiError(409, 'Ten vai tro da ton tai');
    }

    const id = await this.roleRepository.create({ roleName: slug, roleLabel: roleLabel.trim() });
    return this.roleRepository.findById(id);
  }

  /**
   * Cap nhat role
   */
  async updateRole(roleId, { roleLabel }) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');

    if (!roleLabel || !roleLabel.trim()) {
      throw new ApiError(400, 'roleLabel khong duoc rong');
    }

    return this.roleRepository.update(roleId, { roleLabel: roleLabel.trim() });
  }

  /**
   * Xoa role
   */
  async deleteRole(roleId) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');

    // Khong cho xoa role co dinh san
    const protectedRoles = ['admin', 'general_director', 'manager', 'service_advisor', 'team_leader', 'technician', 'warehouse_staff'];
    if (protectedRoles.includes(role.roleName)) {
      throw new ApiError(400, 'Khong the xoa vai tro co san trong he thong');
    }

    const result = await this.roleRepository.delete(roleId);
    if (!result.success) {
      throw new ApiError(409, 'Khong the xoa vai tro dang duoc gan cho nguoi dung');
    }
    return { deleted: true, roleId: Number(roleId) };
  }

  async toggleStatus(roleId) {
    const role = await this.roleRepository.findById(Number(roleId));
    if (!role) throw new ApiError(404, 'Role khong ton tai');
    return this.roleRepository.toggleStatus(roleId);
  }
}

module.exports = RoleService;
