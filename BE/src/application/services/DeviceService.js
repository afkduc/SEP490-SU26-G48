const DeviceRepository = require('../../infrastructure/repositories/DeviceRepository');
const ApiError = require('../../utils/ApiError');

class DeviceService {
  constructor() {
    this.deviceRepository = new DeviceRepository();
  }

  async listByUser(userId) {
    return this.deviceRepository.findByUserId(Number(userId));
  }

  async listAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page, pageSize }) {
    return this.deviceRepository.findAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page, pageSize });
  }

  async forceLogoutDevice(deviceId) {
    const devices = await this.deviceRepository.findAll({ pageSize: 1000 });
    const device = devices.items.find((d) => d.id === Number(deviceId));
    if (!device) throw new ApiError(404, 'Thiet bi khong ton tai');

    // 1. Revoke all tokens for this user
    await this._revokeUserTokens(device.userId);

    // 2. Dong tat ca session active cua user
    await this._closeUserSessions(device.userId);

    // 3. Delete device record
    await this.deviceRepository.delete(deviceId);

    return { deleted: true, deviceId: Number(deviceId), userId: device.userId };
  }

  async _revokeUserTokens(userId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    await query(
      `UPDATE users SET token_version = ISNULL(token_version, 0) + 1 WHERE id = @p1`,
      { p1: Number(userId) }
    );
  }

  async _closeUserSessions(userId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    const result = await query(
      `UPDATE login_sessions
       SET    logout_time              = SYSUTCDATETIME(),
              logout_reason            = 'ADMIN_FORCE_LOGOUT',
              session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                  = 'ended'
       WHERE  user_id    = @p1
         AND  status    = 'active'
         AND  action_type = 'LOGIN'`,
      { p1: Number(userId) }
    );
    if (result.rowsAffected && result.rowsAffected[0] > 0) {
      console.log(`[DeviceService] Closed ${result.rowsAffected[0]} active session(s) for userId=${userId}`);
    }
    return result.rowsAffected ? result.rowsAffected[0] : 0;
  }

  async forceLogoutAllOtherDevices(userId, currentDeviceId) {
    const count = await this.deviceRepository.countActiveByUserId(Number(userId));
    const deleted = await this.deviceRepository.deleteOtherDevices(Number(userId), currentDeviceId);
    return { deleted, remainingCount: count - deleted };
  }
}

module.exports = DeviceService;
