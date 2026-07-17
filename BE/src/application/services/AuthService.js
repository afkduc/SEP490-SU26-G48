const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../../utils/ApiError');
const { toUserDto } = require('../dto/AuthDto');
const config = require('../../config');

class AuthService {
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  async login(email, password) {
    if (!email || !password) {
      const e = new ApiError(400, 'Email và mật khẩu không được để trống');
      e.audit = { skip: true };
      throw e;
    }

    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      // User KHONG ton tai: giu secret (tranh email enumeration), KHONG ghi log
      // vao login_sessions vi se gay rac DB khi spam tu email ao.
      const e = new ApiError(401, 'Email hoặc mật khẩu không đúng');
      e.audit = { userExists: false };
      throw e;
    }

    const isMatch = await this._verifyPassword(password, user.user_password);
    if (!isMatch) {
      // User CO ton tai nhung sai pass: ghi LOGIN_FAILED de audit brute-force.
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
    const userDto = toUserDto(user, roles);

    const token = jwt.sign(
      {
        userId: userDto.id,
        email: userDto.email,
        name: userDto.name,
        roles: userDto.roles,
        branchId: userDto.branchId,
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
