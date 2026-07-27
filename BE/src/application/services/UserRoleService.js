const ApiError = require('../../utils/ApiError');

class UserRoleService {
  constructor({ userRoleRepository, roleRepository, userRepository }) {
    this.userRoleRepository = userRoleRepository;
    this.roleRepository = roleRepository;
    this.userRepository = userRepository;
    this.authRepo = null;
    try {
      // Lazy require de tranh circular import.
      const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
      this.authRepo = new AuthRepositoryImpl();
    } catch (e) {
      console.warn('[UserRoleService] AuthRepositoryImpl not available, token_version bump disabled:', e.message);
    }
  }

  /**
   * Bump token_version cho user (JWT cu vo hieu luc, user phai login lai).
   * Skip actor (admin dang thuc hien) de khong tu logout minh.
   */
  async _bumpTokenVersion(userId, actorId) {
    if (!this.authRepo) return;
    if (Number(userId) === Number(actorId)) return;
    try {
      await this.authRepo.incrementTokenVersion(userId);
    } catch (e) {
      console.warn(`[UserRoleService] bump token_version cho user ${userId} failed:`, e.message);
    }
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
   * @param {number} changedBy - ID của user thực hiện thay đổi
   */
  async assignRoles(userId, roleIds, changedBy) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    if (!roleIds || (Array.isArray(roleIds) && roleIds.length === 0)) {
      throw new ApiError(400, 'roleIds la bat buoc');
    }
    const ids = Array.isArray(roleIds) ? roleIds : [Number(roleIds)];
    const assignedRoles = [];
    if (this.userRepository && typeof this.userRepository.findById === 'function') {
      const targetUser = await this.userRepository.findById(Number(userId));
      if (!targetUser) throw new ApiError(404, `User id=${userId} khong ton tai`);
    }
    for (const roleId of ids) {
      const role = await this.roleRepository.findById(roleId);
      if (!role) throw new ApiError(404, `Role id=${roleId} khong ton tai`);
      await this.userRoleRepository.assignRole(Number(userId), roleId);
      assignedRoles.push(role.role_label || role.role_name);
    }
    const result = await this.userRoleRepository.findByUser(Number(userId));

    // Notify user about role change
    this._sendRoleChangedNotification(userId, 'ASSIGNED', assignedRoles.join(', '), changedBy);

    // Bump token_version -> user bi 401 o request tiep theo (SessionExpiredModal hien)
    await this._bumpTokenVersion(userId, changedBy);

    return result;
  }

  /**
   * Xoa 1 role khoi user
   * @param {number} userId
   * @param {number} roleId
   * @param {number} changedBy - ID của user thực hiện thay đổi
   */
  async revokeRole(userId, roleId, changedBy) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    if (!roleId) throw new ApiError(400, 'roleId la bat buoc');

    if (this.userRepository && typeof this.userRepository.findById === 'function') {
      const targetUser = await this.userRepository.findById(Number(userId));
      if (!targetUser) throw new ApiError(404, `User id=${userId} khong ton tai`);
    }

    // Get role info before revoking for notification
    const role = await this.roleRepository.findById(roleId);
    const roleName = role ? (role.role_label || role.role_name) : '';

    await this.userRoleRepository.removeRole(Number(userId), Number(roleId));
    const result = await this.userRoleRepository.findByUser(Number(userId));

    // Notify user about role revocation
    this._sendRoleChangedNotification(userId, 'REVOKED', roleName, changedBy);

    // Bump token_version
    await this._bumpTokenVersion(userId, changedBy);

    return result;
  }

  /**
   * Xoa toan bo role cua user, roi gan lai
   * @param {number} userId
   * @param {number[]} roleIds
   * @param {number} changedBy - ID của user thực hiện thay đổi
   */
  async setUserRoles(userId, roleIds, changedBy) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    await this.userRoleRepository.removeAllRoles(Number(userId));
    const assignedRoles = [];
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await this.userRoleRepository.assignRole(Number(userId), Number(roleId));
        const role = await this.roleRepository.findById(roleId);
        if (role) assignedRoles.push(role.role_label || role.role_name);
      }
    }
    const result = await this.userRoleRepository.findByUser(Number(userId));

    // Notify user about role change
    if (assignedRoles.length > 0) {
      this._sendRoleChangedNotification(userId, 'ASSIGNED', assignedRoles.join(', '), changedBy);
    }

    // Bump token_version
    await this._bumpTokenVersion(userId, changedBy);

    return result;
  }

  /**
   * Send role changed notification
   */
  _sendRoleChangedNotification(userId, action, roles, changedBy) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      // .catch() bat buoc - notify() la async, khong await o day (fire-and-
      // forget) nen reject se thanh unhandled rejection lam crash ca process.
      ns.notify('ROLE_CHANGED', { userId, action, roles, changedBy }).catch((err) => {
        console.error('[UserRoleService] Failed to send role changed notification:', err.message);
      });
    } catch (err) {
      console.error('[UserRoleService] Failed to send role changed notification:', err.message);
    }
  }
}

module.exports = UserRoleService;
