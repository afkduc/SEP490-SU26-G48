const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../../utils/ApiError');
const { toUserDto } = require('../dto/AuthDto');
const config = require('../../config');
const PermissionService = require('./PermissionService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');

class AuthService {
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  /** Lazy-init PermissionService (avoid circular dependency at module load) */
  _getPermissionService() {
    if (!this._permissionService) {
      this._permissionService = new PermissionService({
        roleRepository: new RoleRepositoryImpl(),
      });
    }
    return this._permissionService;
  }

  async login(email, password) {
    if (!email || !password) {
      const e = new ApiError(400, 'Email và mật khẩu không được để trống');
      e.audit = { skip: true };
      throw e;
    }

    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      const e = new ApiError(401, 'Email hoặc mật khẩu không đúng');
      e.audit = { userExists: false };
      throw e;
    }

    const isMatch = await this._verifyPassword(password, user.user_password);
    if (!isMatch) {
      const e = new ApiError(401, 'Email hoặc mật khẩu không đúng');
      e.audit = { userExists: true, user, reason: 'WRONG_PASSWORD' };
      throw e;
    }

    if (user.status && user.status !== 'active') {
      // status la 'inactive' (ngung hoat dong) hoac bat ky gia tri khac active
      // -> chan login. Migrating tu 'locked' -> 'inactive' (gop 2 status vi
      // logic giong nhau, chi khac UI badge).
      const e = new ApiError(403, 'Tài khoản đã ngừng hoạt động');
      e.audit = { userExists: true, user, reason: 'ACCOUNT_DISABLED' };
      throw e;
    }

    if (user.branch_id && user.branch_is_active !== undefined && !Boolean(user.branch_is_active)) {
      const e = new ApiError(403, 'Chi nhánh của tài khoản này đang bị ngưng hoạt động');
      e.audit = { userExists: true, user, reason: 'BRANCH_DISABLED' };
      throw e;
    }

    // Increment token version de revoke token cu
    const newTokenVersion = await this.authRepository.incrementTokenVersion(user.id);
    user.token_version = newTokenVersion;

    // Tra ve user object (CHUA CO TOKEN) - controller se tao token sau khi co deviceId
    return { user };
  }

  async _verifyPassword(input, stored) {
    if (stored && stored.startsWith('$2b$')) {
      return bcrypt.compare(input, stored);
    }
    // Fallback: plain text (chỉ dùng khi dev, chưa hash password trong DB)
    return input === stored;
  }

  /**
   * Tao JWT moi co deviceId (dung khi login thanh cong)
   */
  async issueTokenWithDevice(user, deviceId) {
    return this._signToken(user, deviceId);
  }

  /**
   * Tao token nhung chua co deviceId - du lieu user phai co token_version
   */
  async issueTokenWithoutDevice(user) {
    return this._signToken(user, null);
  }

  async _signToken(user, deviceId) {
    const roles = await this.authRepository.findUserRoles(user.id);
    const permissionService = this._getPermissionService();
    const permissions = await permissionService.getUserPermissions(user.id);
    const permissionKeys = Array.from(permissions);

    const userDto = toUserDto({ ...user, token_version: user.token_version }, roles, permissionKeys);

    const tokenPayload = {
      userId: userDto.id,
      email: userDto.email,
      name: userDto.name,
      roles: userDto.roles,
      permissions: userDto.permissions,
      branchId: userDto.branchId,
      tokenVersion: userDto.tokenVersion,
    };

    // Chi them deviceId neu co (backward compat voi token cu)
    if (deviceId) {
      tokenPayload.deviceId = deviceId;
    }

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    return { token, user: userDto };
  }
}

module.exports = AuthService;
