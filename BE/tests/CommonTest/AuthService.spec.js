const AuthService = require('../../src/application/services/AuthService');

const activeUser = {
  id: 7,
  user_name: 'Nguyễn Văn A',
  email: 'advisor@autogara.vn',
  phone: '0912345678',
  user_password: 'Password@123',
  status: 'active',
  branch_id: 2,
  branch_is_active: true,
  token_version: 3,
};

function createService({ user = activeUser, roles, liveSession = null } = {}) {
  const repository = {
    findUserByEmailOrPhone: jest.fn().mockResolvedValue(user),
    findUserRoles: jest.fn().mockResolvedValue(roles || [{ role_name: 'service_advisor' }]),
    incrementTokenVersion: jest.fn().mockResolvedValue(4),
  };
  const service = new AuthService(repository);
  service._closeStaleSessionsForUser = jest.fn().mockResolvedValue(undefined);
  service._findLiveSession = jest.fn().mockResolvedValue(liveSession);
  service._closeActiveSessionsForUser = jest.fn().mockResolvedValue(undefined);
  return { service, repository };
}

describe('Đăng nhập dùng chung', () => {
  test('không nhập email hoặc số điện thoại', async () => {
    const { service, repository } = createService();

    await expect(service.login('', 'Password@123', 2)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Email/số điện thoại và mật khẩu không được để trống',
    });
    expect(repository.findUserByEmailOrPhone).not.toHaveBeenCalled();
  });

  test('không nhập mật khẩu', async () => {
    const { service, repository } = createService();

    await expect(service.login('advisor@autogara.vn', '', 2)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Email/số điện thoại và mật khẩu không được để trống',
    });
    expect(repository.findUserByEmailOrPhone).not.toHaveBeenCalled();
  });

  test('email hoặc số điện thoại không tồn tại', async () => {
    const { service, repository } = createService({ user: null });

    await expect(service.login('missing@autogara.vn', 'Password@123', 2)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Email/số điện thoại hoặc mật khẩu không đúng',
    });
    expect(repository.findUserByEmailOrPhone).toHaveBeenCalledWith('missing@autogara.vn');
  });

  test('mật khẩu không đúng', async () => {
    const { service } = createService();

    await expect(service.login('advisor@autogara.vn', 'WrongPassword', 2)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Email/số điện thoại hoặc mật khẩu không đúng',
    });
  });

  test('tài khoản đã ngừng hoạt động', async () => {
    const { service } = createService({ user: { ...activeUser, status: 'inactive' } });

    await expect(service.login('advisor@autogara.vn', 'Password@123', 2)).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
      message: 'Tài khoản đã ngừng hoạt động',
    });
  });

  test('chi nhánh của tài khoản đã ngừng hoạt động', async () => {
    const { service } = createService({ user: { ...activeUser, branch_is_active: false } });

    await expect(service.login('advisor@autogara.vn', 'Password@123', 2)).rejects.toMatchObject({
      statusCode: 403,
      code: 'BRANCH_DISABLED',
      message: 'Chi nhánh của tài khoản này đang bị ngưng hoạt động',
    });
  });

  test('không chọn chi nhánh đối với tài khoản chi nhánh', async () => {
    const { service } = createService();

    await expect(service.login('advisor@autogara.vn', 'Password@123')).rejects.toMatchObject({
      statusCode: 400,
      code: 'BRANCH_REQUIRED',
      message: 'Vui lòng chọn chi nhánh trước khi đăng nhập',
    });
  });

  test('chọn sai chi nhánh của tài khoản', async () => {
    const { service } = createService();

    await expect(service.login('advisor@autogara.vn', 'Password@123', 99)).rejects.toMatchObject({
      statusCode: 403,
      code: 'WRONG_BRANCH',
      message: 'Tài khoản của bạn không có quyền đăng nhập vào chi nhánh này',
    });
  });

  test('đăng nhập bằng email và đúng chi nhánh', async () => {
    const { service, repository } = createService();

    await expect(service.login('advisor@autogara.vn', 'Password@123', 2)).resolves.toMatchObject({
      user: { id: 7, token_version: 4 },
      pendingComplete: false,
      replacedLive: false,
    });
    expect(repository.incrementTokenVersion).toHaveBeenCalledWith(7);
  });

  test('đăng nhập bằng số điện thoại và đúng chi nhánh', async () => {
    const { service, repository } = createService();

    await service.login('0912345678', 'Password@123', 2);

    expect(repository.findUserByEmailOrPhone).toHaveBeenCalledWith('0912345678');
  });

  test('Admin đăng nhập không cần chọn chi nhánh', async () => {
    const { service } = createService({ roles: [{ role_name: 'admin' }] });

    await expect(service.login('admin@autogara.vn', 'Password@123')).resolves.toMatchObject({
      user: { id: 7, token_version: 4 },
      replacedLive: false,
    });
  });

  test('đăng nhập mới thay thế phiên đang hoạt động', async () => {
    const { service } = createService({ liveSession: { id: 88, browser: 'Chrome' } });

    await expect(service.login('advisor@autogara.vn', 'Password@123', 2)).resolves.toMatchObject({
      replacedLive: true,
    });
    expect(service._closeActiveSessionsForUser).toHaveBeenCalledWith(7, 'FORCE_NEW_LOGIN');
  });
});
