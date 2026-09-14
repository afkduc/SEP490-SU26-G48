const mockTrackLogout = jest.fn();

jest.mock('../../src/middlewares/auth', () => ({
  authenticate: (req, res, next) => next(),
}));
jest.mock('../../src/middlewares/loginSessionMiddleware', () => ({
  trackLogout: (...args) => mockTrackLogout(...args),
}));
jest.mock('../../src/presentation/controllers/AuthController', () => jest.fn().mockImplementation(() => ({
  login: jest.fn(),
  listMyLoginChallenges: jest.fn(),
  getPendingLogin: jest.fn(),
  approvePendingLogin: jest.fn(),
  rejectPendingLogin: jest.fn(),
  getMe: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
}))); 
jest.mock('../../src/application/services/AuthService', () => jest.fn().mockImplementation(() => ({
  issueTokenWithDevice: jest.fn(),
})));
jest.mock('../../src/infrastructure/repositories/AuthRepositoryImpl', () => jest.fn());
jest.mock('../../src/application/services/DeviceService', () => jest.fn().mockImplementation(() => ({
  heartbeat: jest.fn(),
})));

const buildAuthRouter = require('../../src/presentation/routes/authRoutes');

function logoutHandler() {
  const router = buildAuthRouter();
  const route = router.stack.find((layer) => layer.route?.path === '/logout');
  return route.route.stack.at(-1).handle;
}

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => {
  mockTrackLogout.mockReset();
});

test('đăng xuất thành công trả thông báo cho giao diện', async () => {
  mockTrackLogout.mockResolvedValue(undefined);
  const req = { user: { userId: 7, sessionId: 88 } };
  const res = response();
  const next = jest.fn();

  await logoutHandler()(req, res, next);

  expect(mockTrackLogout).toHaveBeenCalledWith(req);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ message: 'Đăng xuất thành công' });
  expect(next).not.toHaveBeenCalled();
});

test('lỗi ghi nhận phiên không ngăn người dùng đăng xuất trên giao diện', async () => {
  mockTrackLogout.mockRejectedValue(new Error('Không thể cập nhật phiên'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const res = response();

  await logoutHandler()({ user: { userId: 7, sessionId: 99999 } }, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ message: 'Đăng xuất thành công' });
  expect(warn).toHaveBeenCalledWith(
    '[authRoutes.logout] trackLogout fail (user logout van thanh cong local):',
    'Không thể cập nhật phiên',
  );
  warn.mockRestore();
});
