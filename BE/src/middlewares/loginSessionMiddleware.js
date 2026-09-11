const { query, executeTransaction } = require('../infrastructure/database/sqlServer');
const { emitLoginSessionEvent } = require('../application/events/LoginSessionEvents');

function safeString(value, max = 255) {
  if (value === undefined || value === null) return null;
  const str = String(value);
  return str.length > max ? str.substring(0, max) : str;
}

function parseUserAgent(userAgent) {
  if (!userAgent) return { deviceName: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  const ua = userAgent.toLowerCase();

  // OS phai check TRUOC khi browser, vi UA Edge/Chrome trên Windows
  // van co chu "Mac OS X" trong mot so truong hop dac biet.
  // Uu tien theo thu tu cu the nhat:
  let os = 'Unknown';
  if (ua.includes('windows nt 10.0') || ua.includes('windows nt 11')) os = 'Windows 10/11';
  else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (ua.includes('windows nt 6.2')) os = 'Windows 8';
  else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('mac os x') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('cros')) os = 'Chrome OS';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser: Edge truoc (UA Edge co "Chrome" nhung phai nhan dien truoc)
  let browser = 'Unknown';
  if (ua.includes('edg/') || ua.includes('edge/')) browser = 'Edge';
  else if (ua.includes('opr/') || ua.includes('opera/')) browser = 'Opera';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('chrome/') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('msie') || ua.includes('trident/')) browser = 'Internet Explorer';

  const deviceName = `${browser} on ${os}`;
  return { deviceName: safeString(deviceName, 255), browser: safeString(browser, 100), os: safeString(os, 100) };
}

function getRequestMeta(req) {
  // 1. Cloudflare - CF-Connecting-IP header (độ ưu tiên cao nhất)
  const cfIp = req.headers ? req.headers['cf-connecting-ip'] : null;
  if (cfIp) {
    return {
      ipAddress: safeString(cfIp.split(',')[0].trim(), 45),
      userAgent: safeString(req.headers ? req.headers['user-agent'] : null, 512),
    };
  }

  // 2. X-Real-IP (nginx, traefik)
  const realIp = req.headers ? req.headers['x-real-ip'] : null;
  if (realIp) {
    return {
      ipAddress: safeString(realIp.split(',')[0].trim(), 45),
      userAgent: safeString(req.headers ? req.headers['user-agent'] : null, 512),
    };
  }

  // 3. X-Forwarded-For (proxy chain - apache, load balancer)
  const xff = req.headers ? req.headers['x-forwarded-for'] : null;
  if (xff) {
    return {
      ipAddress: safeString(xff.split(',')[0].trim(), 45),
      userAgent: safeString(req.headers ? req.headers['user-agent'] : null, 512),
    };
  }

  // 4. req.ip (Express, cần trust proxy đúng ở app.js)
  // Khi trust proxy = true, req.ip sẽ là IP của client thật
  return {
    ipAddress: safeString(req.ip || (req.connection && req.connection.remoteAddress) || null, 45),
    userAgent: safeString(req.headers ? req.headers['user-agent'] : null, 512),
  };
}

/**
 * @deprecated Đã gộp vào login_sessions — giữ stub để không break require cũ.
 * deviceId = sessionId sau trackLogin.
 */
async function upsertDevice() {
  return null;
}

function _sendLoginNotification(userId, browser, os, ipAddress, deviceId) {
  try {
    const NotificationService = require('../application/services/NotificationService');
    const ns = new NotificationService();
    const deviceLabel = [browser, os].filter(Boolean).join(' · ') || 'Thiết bị mới';
    // Báo kiểu Facebook: login từ thiết bị/IP mới → luôn hiện in-app (skipSettings)
    ns.notify('NEW_DEVICE', {
      userId,
      browser,
      os,
      ip: ipAddress,
      deviceId,
      device: deviceLabel,
      location: ipAddress || 'vị trí không xác định',
    }, { skipSettings: true }).catch((err) => {
      console.error('[loginSessionMiddleware] Failed to send new-device notification:', err.message);
    });
  } catch (err) {
    console.error('[loginSessionMiddleware] Failed to send login notification:', err.message);
  }
}

function _sendLoginFailedNotification(userId, reason, ipAddress, browser, os) {
  if (!userId) return;
  try {
    const NotificationService = require('../application/services/NotificationService');
    const ns = new NotificationService();
    ns.notify('LOGIN_FAILED', {
      userId,
      reason: reason || 'Sai mật khẩu hoặc thông tin đăng nhập',
      ip: ipAddress,
      browser,
      os,
    }, { skipSettings: true }).catch((err) => {
      console.error('[loginSessionMiddleware] Failed to send login-failed notification:', err.message);
    });
  } catch (err) {
    console.error('[loginSessionMiddleware] Failed to send login-failed notification:', err.message);
  }
}

async function _writeLoginAuditLog(req, { success, userId, userName, reason, ipAddress, branchId = null }) {
  try {
    const { auditLog, ACTION_TYPES } = require('../utils/auditHelper');
    // Gan tam user vao req de auditLog lay dung actor (login chua co JWT)
    const prevUser = req.user;
    const actorLabel = userName || prevUser?.name || prevUser?.email || 'unknown';
    req.user = {
      ...(prevUser || {}),
      userId: userId || prevUser?.userId || null,
      id: userId || prevUser?.id || null,
      name: actorLabel,
      email: userName || prevUser?.email || actorLabel,
      user_name: actorLabel,
      phone: prevUser?.phone || null,
      branch_id: branchId != null ? branchId : (prevUser?.branch_id ?? null),
    };
    await auditLog({
      req,
      action: success ? ACTION_TYPES.LOGIN : ACTION_TYPES.FAILED_LOGIN,
      tableName: 'login_sessions',
      entityName: success ? 'Đăng nhập thành công' : 'Đăng nhập thất bại',
      entityCode: actorLabel || null,
      recordId: userId || null,
      description: success
        ? `Đăng nhập thành công${actorLabel ? `: ${actorLabel}` : ''}${ipAddress ? ` từ ${ipAddress}` : ''}`
        : `Đăng nhập thất bại${actorLabel ? `: ${actorLabel}` : ''}${reason ? ` — ${reason}` : ''}${ipAddress ? ` từ ${ipAddress}` : ''}`,
      responseStatus: success ? 200 : 401,
    });
    req.user = prevUser;
  } catch (err) {
    console.warn('[loginSessionMiddleware] audit_logs write failed (non-blocking):', err.message);
  }
}

async function trackLogin(req, user) {
  try {
    try {
      await require('../infrastructure/repositories/DeviceRepository').ensureSessionDeviceSchema();
    } catch (schemaErr) {
      console.warn('[trackLogin] ensureSessionDeviceSchema:', schemaErr.message);
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const { deviceName, browser, os } = parseUserAgent(userAgent);

    const userId = user && (user.id !== undefined ? user.id : user.user_id) ? user.id : null;
    const userName = safeString(user && (user.user_name || user.name || user.email));
    const phone = safeString(user && user.phone, 32);
    const branchId = user && user.branch_id !== undefined && user.branch_id !== null
      ? user.branch_id
      : null;
    const deviceIp = ipAddress || '0.0.0.0';

    // 1 transaction: đóng phiên cũ + insert phiên mới. deviceId JWT = sessionId.
    const result = await executeTransaction(async (txQuery) => {
      const out = { sessionId: null, deviceId: null, isNewDevice: false, isTrusted: false };

      if (userId) {
        const closeSessions = await txQuery(
          `UPDATE login_sessions
           SET    logout_time              = SYSUTCDATETIME(),
                  logout_reason            = 'NEW_LOGIN_OVERRIDE',
                  session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
                  status                   = 'ended'
           WHERE  user_id     = @p1
             AND  status      = 'active'
             AND  action_type = 'LOGIN'`,
          { p1: userId }
        );
        if (closeSessions.rowsAffected && closeSessions.rowsAffected[0] > 0) {
          console.log(`[trackLogin] Closed ${closeSessions.rowsAffected[0]} previous session(s) for userId=${userId}`);
        }

        const prior = await txQuery(
          `SELECT TOP 1 id, is_trusted
           FROM login_sessions
           WHERE user_id = @p1
             AND action_type = 'LOGIN'
             AND ISNULL(ip_address, N'') = @p2
             AND ISNULL(browser, N'') = @p3
             AND ISNULL(os, N'') = @p4
           ORDER BY login_time DESC`,
          { p1: userId, p2: deviceIp, p3: browser || '', p4: os || '' }
        );
        if (prior.recordset.length > 0) {
          out.isNewDevice = false;
          out.isTrusted = prior.recordset[0].is_trusted === 1 || prior.recordset[0].is_trusted === true;
        } else {
          out.isNewDevice = true;
          out.isTrusted = false;
        }
      } else {
        out.isNewDevice = true;
      }

      const insertResult = await txQuery(
        `INSERT INTO login_sessions
           (action_type, user_id, user_name, phone, ip_address, user_agent,
            browser, os, branch_id, status, login_time, last_activity_at,
            device_name, is_trusted, trusted_at)
         VALUES
           ('LOGIN', @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, 'active',
            SYSUTCDATETIME(), SYSUTCDATETIME(),
            @p9, @p10, @p11);
         SELECT @@IDENTITY AS new_id;`,
        {
          p1: userId,
          p2: userName,
          p3: phone,
          p4: deviceIp,
          p5: userAgent,
          p6: browser,
          p7: os,
          p8: branchId,
          p9: deviceName,
          p10: out.isTrusted ? 1 : 0,
          p11: out.isTrusted ? new Date() : null,
        }
      );

      const rawSessionId = insertResult.recordset?.[0]?.new_id;
      out.sessionId = rawSessionId !== null && rawSessionId !== undefined ? Number(rawSessionId) : null;
      out.deviceId = out.sessionId;
      return out;
    });

    const { sessionId, deviceId, isNewDevice } = result;

    if (sessionId) {
      emitLoginSessionEvent('login', {
        sessionId,
        userId,
        userName,
        phone,
        ipAddress,
        browser,
        os,
        branchId,
        deviceId,
      });
      if (isNewDevice) {
        _sendLoginNotification(userId, browser, os, ipAddress, deviceId);
      }
      await _writeLoginAuditLog(req, {
        success: true,
        userId,
        userName,
        ipAddress,
      });
    }

    return { deviceId, sessionId };
  } catch (err) {
    console.error('[loginSessionMiddleware] trackLogin failed:', err.message ? err.message : err);
    return { deviceId: null, sessionId: null };
  }
}

async function trackLogout(req) {
  try {
    if (!req || !req.user) {
      console.error('[loginSessionMiddleware] trackLogout skipped: req.user missing');
      return;
    }

    // JWT payload co cac field: userId, email, name (la user_name), roles, branchId, deviceId
    const userName = safeString(req.user.name || req.user.user_name);
    const userId = req.user.userId || req.user.id || null;
    const deviceId = req.user.deviceId || null;
    const sessionId = req.user.sessionId || null; // ← QUAN TRONG: dong dung session cua browser hien tai

    if (!userName && !userId) {
      console.error('[loginSessionMiddleware] trackLogout skipped: missing user identifier');
      return;
    }

    const { ipAddress, userAgent } = getRequestMeta(req);

    // BUG CU: chi lay 1 session moi nhat theo user_id → neu user login 2 noi
    // (Edge + Chrome), logout 1 tab chi dong session cua 1 trong 2 browser
    // → browser con lai van hien "Dang hoat dong" tren trang admin.
    //
    // FIX: Uu tien theo deviceId (JWT co deviceId tu login). Neu khong co
    // deviceId (token cu, backward compat) → fallback theo user_id nhu cu,
    // nhung ADDITIONALLY close TAT CA session khac cua user dang su dung
    // status='active' chi giu lai session moi nhat (giam dang bộ).
    let active;
    if (sessionId) {
      active = await query(
        `SELECT TOP 1 id, user_id, ip_address
         FROM login_sessions
         WHERE id = @p1 AND user_id = @p2
           AND status = 'active' AND action_type = 'LOGIN'`,
        { p1: sessionId, p2: userId }
      );
    } else if (deviceId) {
      // deviceId JWT = sessionId (sau khi gộp user_devices)
      active = await query(
        `SELECT TOP 1 id, user_id, ip_address
         FROM login_sessions
         WHERE id = @p1 AND user_id = @p2
           AND status = 'active' AND action_type = 'LOGIN'`,
        { p1: deviceId, p2: userId }
      );
    } else {
      active = await query(
        `SELECT TOP 1 id, user_id
         FROM login_sessions
         WHERE status = 'active' AND action_type = 'LOGIN'
           ${userId ? 'AND user_id = @p1' : 'AND user_name = @p2'}
         ORDER BY login_time DESC`,
        userId ? { p1: userId } : { p2: userName }
      );
    }

    if (!active.recordset.length) {
      // Token moi luon phai logout theo session/device ID; khong fallback sang
      // session khac cua cung user vi se dong nham phien dang nhap.
      if (sessionId || deviceId) {
        console.warn(`[loginSessionMiddleware] trackLogout: session not found for sessionId=${sessionId || 'n/a'}, deviceId=${deviceId || 'n/a'}`);
        return;
      }

      // Token cu khong co ID moi dung fallback theo user.
      const fallback = await query(
        `SELECT TOP 1 id, user_id
         FROM   login_sessions
         WHERE  status = 'active' AND action_type = 'LOGIN'
           ${userId ? 'AND user_id = @p1' : 'AND user_name = @p2'}
         ORDER  BY login_time DESC`,
        userId ? { p1: userId } : { p2: userName }
      );
      if (!fallback.recordset.length) {
        console.warn(`[loginSessionMiddleware] trackLogout: no active session for ${userName || userId}`);
        return;
      }
      active = fallback;
    }

    const endedSessionId = active.recordset[0].id;
    const sessionUserId = active.recordset[0].user_id;

    // (ipAddress, userAgent da duoc lay o tren tu getRequestMeta)

    await query(
      `UPDATE login_sessions
       SET    logout_time                = SYSUTCDATETIME(),
              logout_reason              = 'USER_INITIATED',
              session_duration_seconds   = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                     = 'ended',
              last_activity_at           = SYSUTCDATETIME()
       WHERE  id = @p1`,
      { p1: endedSessionId }
    ).catch((err) => {
      console.error('[loginSessionMiddleware] logout update failed:', err.message);
    });

    // Emit SSE event (status/logout_reason đã ghi trên login_sessions)
    emitLoginSessionEvent('logout', {
      sessionId: endedSessionId,
      userId: sessionUserId,
      userName,
      ipAddress,
      deviceId: endedSessionId,
    });

    try {
      const { auditLog, ACTION_TYPES } = require('../utils/auditHelper');
      await auditLog({
        req,
        action: ACTION_TYPES.LOGOUT,
        tableName: 'login_sessions',
        entityName: 'Đăng xuất',
        entityCode: userName || null,
        recordId: sessionUserId || endedSessionId,
        description: `Đăng xuất${userName ? `: ${userName}` : ''}`,
        responseStatus: 200,
      });
    } catch (auditErr) {
      console.warn('[loginSessionMiddleware] logout audit failed:', auditErr.message);
    }
  } catch (err) {
    console.error('[loginSessionMiddleware] trackLogout ERROR:', err && err.message ? err.message : err);
  }
}

async function trackLoginFailed(req, payload) {
  try {
    const { ipAddress, userAgent } = getRequestMeta(req);
    const { browser, os } = parseUserAgent(userAgent);

    // payload co the la:
    //  - string: chi co email (backward compat)
    //  - object { user, reason }: tu AuthController, co day du thong tin user
    let userId = null;
    let userName = null;
    let phone = null;
    let branchId = null;
    let failureReason = 'WRONG_PASSWORD';

    if (payload && typeof payload === 'object' && payload.user) {
      const u = payload.user;
      userId = u.id ?? u.user_id ?? null;
      userName = safeString(u.user_name || u.name || u.email);
      phone = safeString(u.phone, 32);
      branchId = u.branch_id != null ? u.branch_id : null;
      failureReason = payload.reason || 'WRONG_PASSWORD';
    } else if (typeof payload === 'string') {
      userName = safeString(payload);
    }

    const insertResult = await query(
      `INSERT INTO login_sessions
         (action_type, user_id, user_name, phone, ip_address, user_agent,
          browser, os, branch_id, status, login_time, failure_reason)
       VALUES
         ('LOGIN_FAILED', @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, 'failed', SYSUTCDATETIME(), @p9);
       SELECT @@IDENTITY AS new_id;`,
      {
        p1: userId,
        p2: userName,
        p3: phone,
        p4: ipAddress,
        p5: userAgent,
        p6: browser,
        p7: os,
        p8: branchId,
        p9: failureReason,
      }
    );

    const rawFailedSessionId = insertResult.recordset?.[0]?.new_id;
    const sessionId = rawFailedSessionId !== null && rawFailedSessionId !== undefined ? Number(rawFailedSessionId) : null;
    if (sessionId) {
      // Emit SSE event (chi emi khi co userName vi loi thuong do nhap sai)
      if (userName) {
        emitLoginSessionEvent('login_failed', {
          sessionId,
          userId,
          userName,
          phone,
          ipAddress,
          browser,
          os,
          failureReason,
        });
      }

      // Soft-fail (sai chi nhánh / tài khoản khóa…): không chuông, không audit FAILED_LOGIN.
      // AuthController cũng không gọi trackLoginFailed cho các case này; giữ guard phòng gọi khác.
      const skipSecurityNoise = ['WRONG_BRANCH', 'BRANCH_REQUIRED', 'ACCOUNT_DISABLED', 'BRANCH_DISABLED'];
      if (skipSecurityNoise.includes(failureReason)) {
        return;
      }

      _sendLoginFailedNotification(userId, failureReason, ipAddress, browser, os);
      await _writeLoginAuditLog(req, {
        success: false,
        userId,
        userName,
        reason: failureReason,
        ipAddress,
        branchId,
      });
    }
  } catch (err) {
    console.error('[loginSessionMiddleware] trackLoginFailed failed:', err && err.message ? err.message : err);
  }
}

module.exports = {
  trackLogin,
  trackLogout,
  trackLoginFailed,
  upsertDevice,
  parseUserAgent,
  getRequestMeta,
};