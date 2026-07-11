const ApiError = require('../../utils/ApiError');

class UserRoleService {
  constructor({ userRoleRepository, roleRepository }) {
    this.userRoleRepository = userRoleRepository;
    this.roleRepository = roleRepository;
  }

  /**
   * Lay danh sach role cua user
   */
  async getUserRoles(userId) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    return this.userRoleRepository.findByUser(Number(userId));
  }

  /**
   * Gan role(s) cho user
   * @param {number} userId
   * @param {number|number[]} roleIds - 1 role hoac array role
   */
  async assignRoles(userId, roleIds) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    if (!roleIds || (Array.isArray(roleIds) && roleIds.length === 0)) {
      throw new ApiError(400, 'roleIds la bat buoc');
    }
    const ids = Array.isArray(roleIds) ? roleIds : [Number(roleIds)];
    for (const roleId of ids) {
      const role = await this.roleRepository.findById(roleId);
      if (!role) throw new ApiError(404, `Role id=${roleId} khong ton tai`);
      await this.userRoleRepository.assignRole(Number(userId), roleId);
    }
    return this.userRoleRepository.findByUser(Number(userId));
  }

  /**
   * Xoa 1 role khoi user
   */
  async revokeRole(userId, roleId) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    if (!roleId) throw new ApiError(400, 'roleId la bat buoc');
    await this.userRoleRepository.removeRole(Number(userId), Number(roleId));
    return this.userRoleRepository.findByUser(Number(userId));
  }

  /**
   * Xoa toan bo role cua user, roi gan lai
   */
  async setUserRoles(userId, roleIds) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    await this.userRoleRepository.removeAllRoles(Number(userId));
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await this.userRoleRepository.assignRole(Number(userId), Number(roleId));
      }
    }
    return this.userRoleRepository.findByUser(Number(userId));
  }
}

module.exports = UserRoleService;
