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

  async login(email, password, branchId) {
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

    // Tai khoan gan voi 1 chi nhanh cu the thi bat buoc phai chon dung chi
    // nhanh do o man dang nhap moi cho vao - tranh nhan vien chi nhanh nay
    // dang nhap nham "voi tu cach" chi nhanh khac. Rieng admin/giam doc
    // (general_director) quan ly toan he thong nen duoc mien kiem tra nay du
    // trong DB ho van co the dang gan voi 1 branch_id cu the (VD: chi nhanh
    // chinh de thong ke) - khong dung branch_id == null de xac dinh vi du
    // lieu thuc te khong dam bao dieu do.
    const roles = await this.authRepository.findUserRoles(user.id);
    const isBranchExempt = roles.some(
      (r) => r.role_name === 'admin' || r.role_name === 'general_director'
    );

    if (user.branch_id && !isBranchExempt && String(user.branch_id) !== String(branchId)) {
      const e = new ApiError(403, 'Tài khoản của bạn không có quyền đăng nhập vào chi nhánh này');
      e.audit = { userExists: true, user, reason: 'WRONG_BRANCH' };
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

    if (deviceId) {
      tokenPayload.deviceId = deviceId;
    }
    if (user.sessionId) {
      tokenPayload.sessionId = user.sessionId;
    }

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    return { token, user: userDto };
  }
}

module.exports = AuthService;
