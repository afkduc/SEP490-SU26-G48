const DeviceRepository = require('../../infrastructure/repositories/DeviceRepository');
const ApiError = require('../../utils/ApiError');
const { emitLoginSessionEvent } = require('../events/LoginSessionEvents');

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

    const userId = device.userId;
    const userName = device.userName;

    // 1. Chi revoke DEVICE NAY - set is_current = 0
    // KHONG revoke token_version cua user (vi lam vay se logout TAT CA thiet bi)
    await this._revokeDevice(deviceId);

    // 2. Emit SSE event de thong bao cho admin
    emitLoginSessionEvent('force', {
      userId,
      userName,
      deviceId: Number(deviceId),
    });

    // 3. Notify user about force logout
    this._sendForceLogoutNotification(userId, deviceId);

    return { revoked: true, deviceId: Number(deviceId), userId };
  }

  _sendForceLogoutNotification(userId, deviceId) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      ns.notify('FORCE_LOGOUT', { userId, deviceId });
    } catch (err) {
      console.error('[DeviceService] Failed to send force logout notification:', err.message);
    }
  }

  async _revokeDevice(deviceId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    // Update last_activity_at = now before setting is_current = 0
    // This records the last time device was active (when force logout happened)
    await query(
      `UPDATE user_devices 
       SET last_activity_at = SYSUTCDATETIME(), is_current = 0 
       WHERE id = @p1`,
      { p1: Number(deviceId) }
    );
    console.log(`[DeviceService] Revoked deviceId=${deviceId}`);
  }

  async forceLogoutAllOtherDevices(userId, currentDeviceId) {
    const count = await this.deviceRepository.countActiveByUserId(Number(userId));
    const deleted = await this.deviceRepository.deleteOtherDevices(Number(userId), currentDeviceId);
    return { deleted, remainingCount: count - deleted };
  }

  /**
   * Update last_activity_at with 60s throttle.
   * Only updates if last_activity_at is NULL or >= 60 seconds ago.
   * Returns true if updated, false if skipped.
   */
  async updateLastActivity(deviceId) {
    return this.deviceRepository.updateLastActivityIfNeeded(Number(deviceId));
  }
}

module.exports = DeviceService;
