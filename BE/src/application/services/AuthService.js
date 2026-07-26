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

  async login(identifier, password, branchId, { force = false } = {}) {
    if (!identifier || !password) {
      const e = new ApiError(400, 'Email/số điện thoại và mật khẩu không được để trống');
      e.audit = { skip: true };
      throw e;
    }

    const user = await this.authRepository.findUserByEmailOrPhone(identifier);
    if (!user) {
      const e = new ApiError(401, 'Email/số điện thoại hoặc mật khẩu không đúng');
      e.audit = { userExists: false };
      throw e;
    }

    const isMatch = await this._verifyPassword(password, user.user_password);
    if (!isMatch) {
      const e = new ApiError(401, 'Email/số điện thoại hoặc mật khẩu không đúng');
      e.audit = { userExists: true, user, reason: 'WRONG_PASSWORD' };
      throw e;
    }

    if (user.status && user.status !== 'active') {
      const e = new ApiError(403, 'Tài khoản đã ngừng hoạt động');
      e.audit = { userExists: true, user, reason: 'ACCOUNT_DISABLED' };
      throw e;
    }

    if (user.branch_id && user.branch_is_active !== undefined && !Boolean(user.branch_is_active)) {
      const e = new ApiError(403, 'Chi nhánh của tài khoản này đang bị ngưng hoạt động');
      e.audit = { userExists: true, user, reason: 'BRANCH_DISABLED' };
      throw e;
    }

    const roles = await this.authRepository.findUserRoles(user.id);
    const isBranchExempt = roles.some(
      (r) => r.role_name === 'admin' || r.role_name === 'general_director'
    );

    if (user.branch_id && !isBranchExempt && String(user.branch_id) !== String(branchId)) {
      const e = new ApiError(403, 'Tài khoản của bạn không có quyền đăng nhập vào chi nhánh này');
      e.audit = { userExists: true, user, reason: 'WRONG_BRANCH' };
      throw e;
    }

    // 1 tài khoản = 1 phiên: nếu đang có session active và chưa xác nhận force
    // -> trả 409 để FE hiện modal "Đây là tôi / Hủy"
    if (!force) {
      const { query } = require('../../infrastructure/database/sqlServer');
      const active = await query(
        `SELECT TOP 1 id, browser, os, ip_address, login_time
         FROM login_sessions
         WHERE user_id = @p1 AND status = 'active' AND action_type = 'LOGIN'
         ORDER BY login_time DESC`,
        { p1: user.id }
      );
      if (active.recordset[0]) {
        const s = active.recordset[0];
        const e = new ApiError(
          409,
          'Tài khoản đang được đăng nhập ở thiết bị khác. Xác nhận "Đây là tôi" để tiếp tục (phiên cũ sẽ bị đăng xuất).'
        );
        e.code = 'SESSION_CONFLICT';
        e.details = {
          code: 'SESSION_CONFLICT',
          session: {
            browser: s.browser,
            os: s.os,
            ip: s.ip_address,
            startedAt: s.login_time,
          },
        };
        e.audit = { skip: true };
        throw e;
      }
    }

    const newTokenVersion = await this.authRepository.incrementTokenVersion(user.id);
    user.token_version = newTokenVersion;

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
  async issueTokenWithDevice(user, deviceId, options = {}) {
    return this._signToken(user, deviceId, options);
  }

  /**
   * Tao token nhung chua co deviceId - du lieu user phai co token_version
   */
  async issueTokenWithoutDevice(user, options = {}) {
    return this._signToken(user, null, options);
  }

  async _signToken(user, deviceId, options = {}) {
    const roles = await this.authRepository.findUserRoles(user.id);
    const permissionService = this._getPermissionService();
    // JWT: compact (L1 + screen:*:access + feature keys) — tránh 431.
    // FE UI: effectivePermissions (full flatten L2 view/create/...) lưu localStorage.
    // options.skipCache = true: dung khi refresh permissions (admin vua thay doi).
    const compactKeys = await permissionService.getUserPermissionsCompact(user.id, options);
    const fullPermSet = await permissionService.getUserPermissions(user.id, options);
    const effectivePermissions = Array.from(fullPermSet);

    const userDto = toUserDto({ ...user, token_version: user.token_version }, roles, compactKeys);

    const tokenPayload = {
      userId: userDto.id,
      email: userDto.email,
      name: userDto.name,
      roles: userDto.roles,
      permissions: compactKeys,
      branchId: userDto.branchId,
      tokenVersion: userDto.tokenVersion,
    };

    if (deviceId) {
      tokenPayload.deviceId = deviceId;
    }
    if (user.sessionId) {
      tokenPayload.sessionId = user.sessionId;
    }

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    return { token, user: userDto, effectivePermissions };
  }
}

module.exports = AuthService;
