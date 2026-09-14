jest.mock('../../src/middlewares/loginSessionMiddleware', () => ({
  trackLogin: jest.fn().mockResolvedValue({ deviceId: 88, sessionId: 88 }),
  trackLoginFailed: jest.fn(),
  parseUserAgent: jest.fn().mockReturnValue({ browser: 'Chrome', os: 'Windows 10/11' }),
  getRequestMeta: jest.fn().mockReturnValue({ ipAddress: '127.0.0.1' }),
}));
jest.mock('../../src/application/services/PasswordResetService', () => jest.fn());
jest.mock('../../src/application/services/NotificationService', () => jest.fn());
jest.mock('../../src/infrastructure/repositories/AuthRepositoryImpl', () => jest.fn());
jest.mock('../../src/application/services/LoginAttemptGuard', () => ({
  assertNotLocked: jest.fn(),
  clearFailures: jest.fn(),
  recordFailure: jest.fn(),
}));

const AuthController = require('../../src/presentation/controllers/AuthController');

test('đăng nhập thành công trả đúng thông báo cho giao diện', async () => {
  const user = { id: 7, user_name: 'Nguyễn Văn A', token_version: 4 };
  const authService = {
    login: jest.fn().mockResolvedValue({ user, replacedLive: false, clientMeta: {} }),
    issueTokenWithDevice: jest.fn().mockResolvedValue({
      token: 'jwt-token',
      user: { id: 7, name: 'Nguyễn Văn A', permissions: [] },
      effectivePermissions: ['repair:read'],
    }),
  };
  const controller = new AuthController(authService);
  const req = {
    body: {
      identifier: 'advisor@autogara.vn',
      password: 'Password@123',
      branchId: 2,
    },
    headers: { 'user-agent': 'Chrome' },
    ip: '127.0.0.1',
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();

  await controller.login(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(authService.login).toHaveBeenCalledWith(
    'advisor@autogara.vn',
    'Password@123',
    2,
    expect.objectContaining({ force: false, pendingId: null }),
  );
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    message: 'Đăng nhập thành công',
    data: expect.objectContaining({ token: 'jwt-token' }),
  }));
});
