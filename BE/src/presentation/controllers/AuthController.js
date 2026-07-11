const { success } = require('../../utils/response');
const { trackLogin, trackLoginFailed } = require('../../middlewares/loginSessionMiddleware');

class AuthController {
  constructor(authService) {
    this.authService = authService;
    this.login = this.login.bind(this);
    this.getMe = this.getMe.bind(this);
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      trackLogin(req, result.user || result).catch((e) =>
        console.error('[AuthController] trackLogin error:', e.message)
      );
      return success(res, result, 'Đăng nhập thành công');
    } catch (err) {
      trackLoginFailed(req, email).catch((e) =>
        console.error('[AuthController] trackLoginFailed error:', e.message)
      );
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      return success(res, req.user, 'Lấy thông tin thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
