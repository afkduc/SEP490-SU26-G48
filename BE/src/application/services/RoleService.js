const ApiError = require('../../utils/ApiError');

class RoleService {
  constructor({ roleRepository }) {
    this.roleRepository = roleRepository;
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
}

module.exports = RoleService;
