const DeviceRepository = require('../../infrastructure/repositories/DeviceRepository');
const ApiError = require('../../utils/ApiError');
const { emitLoginSessionEvent } = require('../events/LoginSessionEvents');

/**
 * deviceId trong API/JWT = login_sessions.id (đã gộp user_devices).
 */
class DeviceService {
  constructor() {
    this.deviceRepository = new DeviceRepository();
  }

  async listByUser(userId) {
    return this.deviceRepository.findByUserId(Number(userId));
  }

  async listAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page, pageSize }) {
    return this.deviceRepository.findAll({
      userId, search, browser, os, isCurrent, dateFrom, dateTo, page, pageSize,
    });
  }

  async forceLogoutDevice(deviceId) {
    const sessionId = Number(deviceId);
    const device = await this.deviceRepository.findById(sessionId);
    if (!device) throw new ApiError(404, 'Thiet bi khong ton tai');

    const userId = device.userId;
    const userName = device.userName;

    await this._endSessionById(sessionId, 'FORCE_LOGO');

    const otherActiveCount = await this.deviceRepository.countActiveByUserId(userId);
    if (otherActiveCount === 0) {
      await this._incrementTokenVersion(userId);
      console.log(`[DeviceService] User ${userId} has no other sessions, token_version incremented`);
    }

    emitLoginSessionEvent('force', {
      userId,
      userName,
      deviceId: sessionId,
      sessionId,
      revokedAt: new Date().toISOString(),
    });

    this._sendForceLogoutNotification(userId, sessionId);

    return { revoked: true, deviceId: sessionId, userId };
  }

  _sendForceLogoutNotification(userId, deviceId) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      ns.notify('FORCE_LOGO', { userId, deviceId }).catch((err) => {
        console.error('[DeviceService] Failed to send force logout notification:', err.message);
      });
    } catch (err) {
      console.error('[DeviceService] Failed to send force logout notification:', err.message);
    }
  }

  async _endSessionById(sessionId, logoutReason = 'FORCE_LOGO') {
    const { query } = require('../../infrastructure/database/sqlServer');
    const id = Number(sessionId);
    if (!id) return 0;

    const upd = await query(
      `UPDATE login_sessions
       SET    logout_time              = SYSUTCDATETIME(),
              logout_reason            = @p2,
              session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                   = 'ended',
              last_activity_at         = SYSUTCDATETIME()
       WHERE  id           = @p1
         AND  status       = 'active'
         AND  action_type  = 'LOGIN'`,
      { p1: id, p2: logoutReason }
    );
    const endedCount = upd.rowsAffected && upd.rowsAffected[0] ? upd.rowsAffected[0] : 0;
    console.log(`[DeviceService] Ended ${endedCount} session(s) for id=${id} (reason=${logoutReason})`);
    return endedCount;
  }

  async forceLogoutAllDevices(userId) {
    const userNumId = Number(userId);

    const devices = await this.deviceRepository.findActiveByUserId(userNumId);
    const userName = devices[0]?.userName || 'Unknown';
    const sessionIds = devices.map((d) => d.id);

    if (devices.length === 0) {
      return { revoked: 0, message: 'Khong co thiet bi nao dang hoat dong' };
    }

    await this.deviceRepository.revokeAllDevices(userNumId);
    await this._incrementTokenVersion(userNumId);

    sessionIds.forEach((sessionId) => {
      emitLoginSessionEvent('force', {
        userId: userNumId,
        userName,
        deviceId: sessionId,
        sessionId,
        revokedAt: new Date().toISOString(),
      });
    });

    this._sendForceLogoutNotification(userNumId, null);

    console.log(`[DeviceService] Force logout user ${userNumId}, revoked ${devices.length} sessions, token_version incremented`);
    return { revoked: devices.length, userId: userNumId };
  }

  async _incrementTokenVersion(userId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    await query(
      `UPDATE users SET token_version = ISNULL(token_version, 0) + 1 WHERE id = @p1`,
      { p1: userId }
    );
  }

  async updateLastActivity(deviceId) {
    return this.deviceRepository.updateLastActivityIfNeeded(Number(deviceId));
  }

  /**
   * Heartbeat: deviceId = sessionId.
   */
  async heartbeat(deviceId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    const sessionId = Number(deviceId);

    const updatedDevice = await this.deviceRepository.updateLastActivityIfNeeded(sessionId);

    // Revive TIMEOUT gần đây nếu user còn heartbeat và chưa có session active khác
    await query(
      `UPDATE ls
       SET    ls.status = 'active',
              ls.logout_time = NULL,
              ls.logout_reason = NULL,
              ls.session_duration_seconds = NULL,
              ls.last_activity_at = SYSUTCDATETIME()
       FROM   login_sessions ls
       WHERE  ls.id = @p1
         AND  ls.status = 'ended'
         AND  ls.logout_reason = 'TIMEOUT'
         AND  ls.action_type = 'LOGIN'
         AND  ls.logout_time >= DATEADD(HOUR, -2, SYSUTCDATETIME())
         AND  NOT EXISTS (
           SELECT 1 FROM login_sessions a
           WHERE  a.user_id = ls.user_id
             AND  a.status = 'active'
             AND  a.action_type = 'LOGIN'
             AND  a.id <> ls.id
         )`,
      { p1: sessionId }
    );

    await query(
      `UPDATE login_sessions
       SET    last_activity_at = SYSUTCDATETIME()
       WHERE  id = @p1
         AND  status = 'active'
         AND  action_type = 'LOGIN'
         AND  (last_activity_at IS NULL
               OR last_activity_at < DATEADD(SECOND, -60, SYSUTCDATETIME()))`,
      { p1: sessionId }
    );

    return {
      updated: updatedDevice,
      deviceId: sessionId,
      serverTime: new Date().toISOString(),
    };
  }
}

module.exports = DeviceService;
