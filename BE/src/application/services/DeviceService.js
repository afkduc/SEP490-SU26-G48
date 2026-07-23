const DeviceRepository = require('../../infrastructure/repositories/DeviceRepository');
const ApiError = require('../../utils/ApiError');
const { emitLoginSessionEvent } = require('../events/LoginSessionEvents');
const { auditCrud } = require('../../utils/auditHelper');

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
    // Toi uu: goi findById truc tiep thay vi findAll(pageSize:1000) de
    // tranh miss khi user co nhieu device.
    const device = await this.deviceRepository.findById(Number(deviceId));
    if (!device) throw new ApiError(404, 'Thiet bi khong ton tai');

    const userId = device.userId;
    const userName = device.userName;

    // 1. Revoke THIS device - set is_current = 0
    await this._revokeDevice(deviceId);

    // 2. Check if user has other active devices
    // If NO other active devices -> increment token_version to invalidate JWT immediately
    // If YES other devices -> just revoke this device, user can still use other sessions
    const otherActiveCount = await this.deviceRepository.countActiveByUserId(userId);
    if (otherActiveCount === 0) {
      // No other active devices -> must invalidate JWT
      await this._incrementTokenVersion(userId);
      console.log(`[DeviceService] User ${userId} has no other devices, token_version incremented`);
    }

    // 3. Emit SSE event for real-time admin login history update
    emitLoginSessionEvent('force', {
      userId,
      userName,
      deviceId: Number(deviceId),
      revokedAt: new Date().toISOString(),
    });

    // 4. Send notification to user about force logout
    this._sendForceLogoutNotification(userId, deviceId);

    return { revoked: true, deviceId: Number(deviceId), userId };
  }

  _sendForceLogoutNotification(userId, deviceId) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      // .catch() bat buoc - notify() la async, khong await o day (fire-and-
      // forget) nen reject se thanh unhandled rejection lam crash ca process.
      ns.notify('FORCE_LOGOUT', { userId, deviceId }).catch((err) => {
        console.error('[DeviceService] Failed to send force logout notification:', err.message);
      });
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
    // BUG CU (off-by-one + semantic mismatch):
    //   - count = so device ACTIVE (is_current=1) cua user
    //   - deleteOtherDevices xoa TAT CA device khac current (ke ca is_current=0)
    //   -> remainingCount = count - deleted cho ket qua sai
    //      (vi count chi dem is_current=1, nhung deleted dem tat ca)
    //
    // FIX: Dem dong nhat theo is_current=1 (semantic "active devices").
    // Neu user chi co 1 device (current) va khong co currentDeviceId (admin force
    // tu trang admin khong biet current device) -> deleted = 0 vi @p2 IS NULL
    // trong SQL -> tat ca device (kha nang ca current) bi xoa. Sau do:
    // remainingCount = activeCountBefore - activeDeletedAfter de chinh xac.
    const { query } = require('../../infrastructure/database/sqlServer');
    const userNum = Number(userId);
    const cur = currentDeviceId == null ? null : Number(currentDeviceId);

    // Dem so device active TRUOC khi xoa
    const beforeResult = await query(
      `SELECT COUNT(*) AS c FROM user_devices WHERE user_id = @p1 AND is_current = 1`,
      { p1: userNum }
    );
    const activeBefore = Number(beforeResult.recordset[0].c);

    // Dem so device se bi xoa va co is_current=1 (tru current neu co)
    const willDeleteActiveResult = await query(
      `SELECT COUNT(*) AS c FROM user_devices
        WHERE user_id = @p1
          AND is_current = 1
          AND (@p2 IS NULL OR id != @p2)`,
      { p1: userNum, p2: cur }
    );
    const activeDeleted = Number(willDeleteActiveResult.recordset[0].c);

    // Thuc su xoa (logic giu nguyen repository.deleteOtherDevices)
    const totalDeleted = await this.deviceRepository.deleteOtherDevices(userNum, cur);

    // remainingCount = so device ACTIVE con lai (is_current=1)
    // Truong hop dat biet: neu cur==null va co it nhat 1 device is_current=1
    // -> activeDeleted co the = activeBefore (xoa het) -> remaining = 0.
    // Neu cur!=null -> KHONG bao gio xoa current device -> remaining >= 1.
    const remainingCount = Math.max(0, activeBefore - activeDeleted);

    return {
      deleted: totalDeleted,
      activeDeleted,
      remainingCount,
    };
  }

  /**
   * Admin force logout ALL devices of a user (including current device).
   * Used when admin wants to completely terminate all sessions of a user.
   *
   * Flow:
   * 1. Revoke all devices (set is_current = 0)
   * 2. Increment token_version -> ALL JWTs of this user become INVALID immediately
   * 3. Emit SSE event -> Admin login history updates real-time
   * 4. Send notification to user
   */
  async forceLogoutAllDevices(userId) {
    const userNumId = Number(userId);
    
    // Get user info for notification
    const devices = await this.deviceRepository.findActiveByUserId(userNumId);
    const userName = devices[0]?.userName || 'Unknown';
    const deviceIds = devices.map(d => d.id);
    
    if (devices.length === 0) {
      return { revoked: 0, message: 'Khong co thiet bi nao dang hoat dong' };
    }

    // 1. Revoke all devices
    await this.deviceRepository.revokeAllDevices(userNumId);

    // 2. INCREMENT TOKEN VERSION -> All JWTs of this user become INVALID immediately!
    await this._incrementTokenVersion(userNumId);

    // 3. Emit SSE event for real-time login history update
    deviceIds.forEach(deviceId => {
      emitLoginSessionEvent('force', {
        userId: userNumId,
        userName,
        deviceId,
        revokedAt: new Date().toISOString(),
      });
    });

    // 4. Send notification to user
    this._sendForceLogoutNotification(userNumId, null);

    console.log(`[DeviceService] Force logout user ${userNumId}, revoked ${devices.length} devices, token_version incremented`);
    return { revoked: devices.length, userId: userNumId };
  }

  /**
   * Increment user's token_version to invalidate all existing JWTs.
   * This makes ALL active sessions of this user immediately invalid.
   */
  async _incrementTokenVersion(userId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    await query(
      `UPDATE users SET token_version = ISNULL(token_version, 0) + 1 WHERE id = @p1`,
      { p1: userId }
    );
  }

  /**
   * Update last_activity_at with 60s throttle.
   * Only updates if last_activity_at is NULL or >= 60 seconds ago.
   * Returns true if updated, false if skipped.
   */
  async updateLastActivity(deviceId) {
    return this.deviceRepository.updateLastActivityIfNeeded(Number(deviceId));
  }

  /**
   * Heartbeat tu client (FE goi dinh ky, vi du 60s).
   * Tra ve server time UTC de FE tinh clock offset, tranh
   * truong hop clock client sai lam UI hien thi sai last_activity_at.
   */
  async heartbeat(deviceId) {
    const updated = await this.deviceRepository.updateLastActivityIfNeeded(Number(deviceId));
    return {
      updated,
      deviceId: Number(deviceId),
      serverTime: new Date().toISOString(),
    };
  }
}

module.exports = DeviceService;
