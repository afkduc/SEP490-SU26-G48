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
      const e = new ApiError(403, 'Tài khoản đã bị khóa');
      e.audit = { userExists: true, user, reason: 'ACCOUNT_DISABLED' };
      throw e;
    }

    const roles = await this.authRepository.findUserRoles(user.id);

    // Lay permissions tu DB
    const permissionService = this._getPermissionService();
    const permissions = await permissionService.getUserPermissions(user.id);
    const permissionKeys = Array.from(permissions);

    const newTokenVersion = await this.authRepository.incrementTokenVersion(user.id);

    const userDto = toUserDto({ ...user, token_version: newTokenVersion }, roles, permissionKeys);

    const token = jwt.sign(
      {
        userId: userDto.id,
        email: userDto.email,
        name: userDto.name,
        roles: userDto.roles,
        permissions: userDto.permissions,
        branchId: userDto.branchId,
        tokenVersion: userDto.tokenVersion,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return { token, user: userDto };
  }

  async _verifyPassword(input, stored) {
    if (stored && stored.startsWith('$2b$')) {
      return bcrypt.compare(input, stored);
    }
    // Fallback: plain text (chỉ dùng khi dev, chưa hash password trong DB)
    return input === stored;
  }
}

module.exports = AuthService;
