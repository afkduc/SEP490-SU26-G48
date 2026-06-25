const { success } = require('../../utils/response');

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
      return success(res, result, 'Đăng nhập thành công');
    } catch (err) {
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
