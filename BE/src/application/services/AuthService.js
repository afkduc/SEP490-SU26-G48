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
      throw new ApiError(400, 'Email và mật khẩu không được để trống');
    }

    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      throw new ApiError(401, 'Email hoặc mật khẩu không đúng');
    }

    const isMatch = await this._verifyPassword(password, user.user_password);
    if (!isMatch) {
      throw new ApiError(401, 'Email hoặc mật khẩu không đúng');
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
