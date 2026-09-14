jest.mock('../../src/infrastructure/database/sqlServer', () => ({
  query: jest.fn(),
  executeTransaction: jest.fn(),
}));
jest.mock('../../src/application/events/LoginSessionEvents', () => ({
  emitLoginSessionEvent: jest.fn(),
}));
jest.mock('../../src/utils/auditHelper', () => ({
  auditLog: jest.fn(),
  ACTION_TYPES: { LOGOUT: 'LOGOUT' },
}));

const { query } = require('../../src/infrastructure/database/sqlServer');
const { emitLoginSessionEvent } = require('../../src/application/events/LoginSessionEvents');
const { auditLog } = require('../../src/utils/auditHelper');
const { trackLogout } = require('../../src/middlewares/loginSessionMiddleware');

describe('Đăng xuất dùng chung', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditLog.mockResolvedValue(undefined);
  });

  test('đăng xuất đúng phiên đăng nhập hiện tại', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ id: 88, user_id: 7, ip_address: '127.0.0.1' }] })
      .mockResolvedValueOnce({ rowsAffected: [1] });
    const req = {
      user: { userId: 7, name: 'Nguyễn Văn A', sessionId: 88, deviceId: 88 },
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/120.0' },
      ip: '127.0.0.1',
    };

    await trackLogout(req);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE id = @p1 AND user_id = @p2'),
      { p1: 88, p2: 7 },
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("logout_reason              = 'USER_INITIATED'"),
      { p1: 88 },
    );
    expect(emitLoginSessionEvent).toHaveBeenCalledWith('logout', expect.objectContaining({
      sessionId: 88,
      userId: 7,
      userName: 'Nguyễn Văn A',
    }));
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGOUT',
      tableName: 'login_sessions',
      recordId: 7,
      responseStatus: 200,
    }));
  });

  test('không đóng nhầm phiên khác khi mã phiên không tồn tại', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const req = {
      user: { userId: 7, name: 'Nguyễn Văn A', sessionId: 99999, deviceId: 99999 },
      headers: {},
      ip: '127.0.0.1',
    };

    await trackLogout(req);

    expect(query).toHaveBeenCalledTimes(1);
    expect(emitLoginSessionEvent).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('session not found'));
    warn.mockRestore();
  });
});
