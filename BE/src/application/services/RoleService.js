class RoleService {
  constructor({ roleRepository }) {
    this.roleRepository = roleRepository;
  }

  /**
   * Danh sách role (dropdown gán role cho user).
   * Không còn API CRUD role / ma trận phân quyền trên UI.
   */
  async listRoles() {
    const roles = await this.roleRepository.findAll();
    return { items: roles, total: roles.length };
  }
}

module.exports = RoleService;
