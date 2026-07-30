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

  async listAll({ userId, search, browser, os, isCurrent, isTrusted, dateFrom, dateTo, page, pageSize }) {
    return this.deviceRepository.findAll({
      userId, search, browser, os, isCurrent, isTrusted, dateFrom, dateTo, page, pageSize,
    });
  }

  async setTrustedForOwner(_userId, _deviceId, _trusted) {
    throw new ApiError(
      403,
      'Chức năng đánh dấu thiết bị tin cậy đã tắt. Dùng đăng xuất thiết bị hoặc quên mật khẩu nếu nghi ngờ.'
    );
  }

  /**
   * @deprecated Chức năng tin cậy đã tắt.
   */
  async setTrustedByAdmin(_deviceId, _trusted, _actorUserId) {
    throw new ApiError(
      403,
      'Chức năng đánh dấu thiết bị tin cậy đã tắt. Dùng đăng xuất thiết bị nếu nghi ngờ.'
    );
  }

  async forceLogoutDevice(deviceId) {
    // Toi uu: goi findById truc tiep thay vi findAll(pageSize:1000) de
    // tranh miss khi user co nhieu device.
    const device = await this.deviceRepository.findById(Number(deviceId));
    if (!device) throw new ApiError(404, 'Thiet bi khong ton tai');

    const userId = device.userId;
    const userName = device.userName;

    // 1. End session thuoc device nay (status -> 'ended', logout_reason = FORCE_LOGO)
    //    Phai lam TRUOC khi revoke device de tranh mat FK linkage.
    await this._endSessionsByDeviceId(Number(deviceId), 'FORCE_LOGO');

    // 2. Revoke THIS device - set is_current = 0
    await this._revokeDevice(deviceId);

    // 3. Check if user has other active devices
    // If NO other active devices -> increment token_version to invalidate JWT immediately
    // If YES other devices -> just revoke this device, user can still use other sessions
    const otherActiveCount = await this.deviceRepository.countActiveByUserId(userId);
    if (otherActiveCount === 0) {
      // No other active devices -> must invalidate JWT
      await this._incrementTokenVersion(userId);
      console.log(`[DeviceService] User ${userId} has no other devices, token_version incremented`);
    }

    // 4. Emit SSE event for real-time admin login history update
    emitLoginSessionEvent('force', {
      userId,
      userName,
      deviceId: Number(deviceId),
      revokedAt: new Date().toISOString(),
    });

    // 5. Send notification to user about force logout
    this._sendForceLogoutNotification(userId, deviceId);

    return { revoked: true, deviceId: Number(deviceId), userId };
  }

  _sendForceLogoutNotification(userId, deviceId) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      // .catch() bat buoc - notify() la async, khong await o day (fire-and-
      // forget) nen reject se thanh unhandled rejection lam crash ca process.
      ns.notify('FORCE_LOGO', { userId, deviceId }).catch((err) => {
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

  /**
   * End ALL active sessions of a given device with the given logout_reason.
   *
   * Dung cho 3 flow:
   *   - forceLogoutDevice       (admin da 1 device cu the)
   *   - forceLogoutAllDevices    (admin da toan bo device cua user)
   *   - forceLogoutAllOtherDevices (admin da cac device khac cua user)
   *
   * Sau khi UPDATE login_sessions (status -> 'ended'), ghi event
   * FORCE_LOGO vao login_session_events cho moi session bi end
   * de audit log ro rang va admin co the theo doi realtime qua SSE.
   *
   * QUAN TRONG:
   *   - Phai goi TRUOC khi xoa/revoke device vi sau khi device bi xoa,
   *     FK tu login_sessions.device_id co the chan hoac thanh NULL.
   *   - Tra ve so session da end de log + audit.
   */
  async _endSessionsByDeviceId(deviceId, logoutReason = 'FORCE_LOGO') {
    const { query } = require('../../infrastructure/database/sqlServer');
    const deviceNum = Number(deviceId);
    if (!deviceNum) return 0;

    // Lay danh sach session ACTIVE thuoc device nay (can de ghi event rieng
    // cho tung session). Lay TRUOC khi UPDATE vi sau UPDATE khong con
    // row nao status='active' de filter.
    const sessions = await query(
      `SELECT id, user_id, user_name, ip_address, user_agent
       FROM   login_sessions
       WHERE  device_id = @p1
         AND  status    = 'active'
         AND  action_type = 'LOGIN'`,
      { p1: deviceNum }
    );
    const sessionRows = sessions.recordset || [];
    if (sessionRows.length === 0) {
      return 0;
    }

    // UPDATE login_sessions: status -> 'ended'
    const upd = await query(
      `UPDATE login_sessions
       SET    logout_time              = SYSUTCDATETIME(),
              logout_reason            = @p2,
              session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                   = 'ended'
       WHERE  device_id    = @p1
         AND  status       = 'active'
         AND  action_type  = 'LOGIN'`,
      { p1: deviceNum, p2: logoutReason }
    );
    const endedCount = upd.rowsAffected && upd.rowsAffected[0] ? upd.rowsAffected[0] : 0;

    // Ghi FORCE_LOGO event cho moi session bi end (khong dan den qua nhieu row:
    // 1 user chi co 1 active session / device trong single-session mode).
    for (const s of sessionRows) {
      try {
        await query(
          `INSERT INTO login_session_events
             (session_id, event_type, user_id, user_name, ip_address, user_agent)
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6)`,
          {
            p1: s.id,
            p2: 'FORCE_LOGO',
            p3: s.user_id,
            p4: s.user_name,
            p5: s.ip_address,
            p6: s.user_agent,
          }
        );
      } catch (evErr) {
        console.error('[DeviceService] Failed to write FORCE_LOGO event for session', s.id, evErr.message);
      }
    }

    console.log(`[DeviceService] Ended ${endedCount} session(s) for deviceId=${deviceNum} (reason=${logoutReason})`);
    return endedCount;
  }

  /**
   * End active sessions theo list deviceIds (dung cho forceLogoutAllDevices).
   * Tra ve tong so session da end.
   */
  async _endSessionsByDeviceIds(deviceIds, logoutReason = 'FORCE_LOGO') {
    let total = 0;
    for (const id of deviceIds) {
      const n = await this._endSessionsByDeviceId(id, logoutReason);
      total += n;
    }
    return total;
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

    // Lay danh sach deviceId se bi XOA -> end session tuong ung TRUOC khi xoa
    // (vi FK device_id co the NULL sau khi xoa device, va ta muon session
    // status chuyen 'ended' ngay lap tuc).
    const deviceIdsRes = await query(
      `SELECT id FROM user_devices
       WHERE user_id = @p1
         AND (@p2 IS NULL OR id != @p2)`,
      { p1: userNum, p2: cur }
    );
    const deviceIdsToDelete = (deviceIdsRes.recordset || []).map(r => r.id);
    await this._endSessionsByDeviceIds(deviceIdsToDelete, 'FORCE_LOGO');

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

    // 1. End all active sessions thuoc cac device cua user (TRUOC khi revoke
    //    de tranh FK device_id NULL/INVALID sau revoke lam session orphan).
    await this._endSessionsByDeviceIds(deviceIds, 'FORCE_LOGO');

    // 2. Revoke all devices
    await this.deviceRepository.revokeAllDevices(userNumId);

    // 3. INCREMENT TOKEN VERSION -> All JWTs of this user become INVALID immediately!
    await this._incrementTokenVersion(userNumId);

    // 4. Emit SSE event for real-time login history update
    deviceIds.forEach(deviceId => {
      emitLoginSessionEvent('force', {
        userId: userNumId,
        userName,
        deviceId,
        revokedAt: new Date().toISOString(),
      });
    });

    // 5. Send notification to user
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
    const { query } = require('../../infrastructure/database/sqlServer');
    const devId = Number(deviceId);
    // 1. Update user_devices.last_activity_at
    const updatedDevice = await this.deviceRepository.updateLastActivityIfNeeded(devId);

    // 2. Neu session vua bi TIMEOUT nham (user van heartbeat) → mo lai
    //    Chi revive session TIMEOUT gan day cua dung device, va chi khi
    //    user khong con session active nao khac.
    await query(
      `UPDATE ls
       SET    ls.status = 'active',
              ls.logout_time = NULL,
              ls.logout_reason = NULL,
              ls.session_duration_seconds = NULL,
              ls.last_activity_at = SYSUTCDATETIME()
       FROM   login_sessions ls
       INNER JOIN user_devices ud ON ud.id = @p1 AND ud.user_id = ls.user_id
       WHERE  ls.device_id = @p1
         AND  ls.status = 'ended'
         AND  ls.logout_reason = 'TIMEOUT'
         AND  ls.action_type = 'LOGIN'
         AND  ls.logout_time >= DATEADD(HOUR, -2, SYSUTCDATETIME())
         AND  NOT EXISTS (
           SELECT 1 FROM login_sessions a
           WHERE  a.user_id = ls.user_id
             AND  a.status = 'active'
             AND  a.action_type = 'LOGIN'
         )`,
      { p1: devId }
    );

    // 3. Chi update session active GAN DUNG device nay (khong touch session thiet bi khac).
    await query(
      `UPDATE ls
       SET    ls.last_activity_at = SYSUTCDATETIME()
       FROM   login_sessions ls
       WHERE  ls.device_id = @p1
         AND  ls.status = 'active'
         AND  ls.action_type = 'LOGIN'
         AND  (ls.last_activity_at IS NULL
               OR ls.last_activity_at < DATEADD(SECOND, -60, SYSUTCDATETIME()))`,
      { p1: devId }
    );

    // 4. Heal is_current CHI khi DUNG device nay con session active.
    // Bug cu: check EXISTS session cua USER → device cu bi bat lai "Hiện tại"
    // khi user da login o thiet bi khac (2 dong Hiện tại cùng lúc).
    await query(
      `UPDATE ud
       SET    ud.is_current = 1
       FROM   user_devices ud
       WHERE  ud.id = @p1
         AND  ud.is_current = 0
         AND  EXISTS (
           SELECT 1 FROM login_sessions ls
           WHERE  ls.device_id = ud.id
             AND  ls.user_id = ud.user_id
             AND  ls.status = 'active'
             AND  ls.action_type = 'LOGIN'
         )`,
      { p1: devId }
    );

    // 5. Single-session: neu device nay dang current thi tat cac device khac cung user.
    await query(
      `UPDATE other
       SET    other.is_current = 0
       FROM   user_devices other
       INNER JOIN user_devices cur ON cur.id = @p1 AND cur.user_id = other.user_id
       WHERE  other.id <> @p1
         AND  other.is_current = 1
         AND  cur.is_current = 1`,
      { p1: devId }
    );

    return {
      updated: updatedDevice,
      deviceId: devId,
      serverTime: new Date().toISOString(),
    };
  }
}

module.exports = DeviceService;
