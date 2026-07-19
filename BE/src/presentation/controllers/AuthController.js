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

      // 1. Authenticate user first (tra ve { user } - chua co token)
      const { user } = await this.authService.login(email, password);

      // 2. Track login with full user info to get deviceId
      const trackResult = await trackLogin(req, user);
      const deviceId = trackResult?.deviceId || null;

      // 3. Tao token voi deviceId (chi tao 1 lan)
      const result = await this.authService.issueTokenWithDevice(user, deviceId);
      return success(res, result, 'Đăng nhập thành công');
    } catch (err) {
      // Chi ghi LOGIN_FAILED khi user ton tai (sai pass / tai khoan bi khoa).
      // Neu user khong ton tai hoac loi validate -> KHONG ghi log de tranh
      // spam DB voi cac email ao.
      const audit = err && err.audit;
      if (audit && audit.userExists && audit.user) {
        trackLoginFailed(req, {
          user: audit.user,
          reason: audit.reason || 'WRONG_PASSWORD',
        }).catch((e) =>
          console.error('[AuthController] trackLoginFailed error:', e.message)
        );
      }
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      // req.user da co permissions tu auth middleware
      return success(res, req.user, 'Lấy thông tin thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
