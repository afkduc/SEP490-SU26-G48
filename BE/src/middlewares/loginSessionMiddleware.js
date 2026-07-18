const { query } = require('../infrastructure/database/sqlServer');

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
  const xff = req.headers ? req.headers['x-forwarded-for'] : null;
  let ipAddress = null;
  if (xff) {
    ipAddress = xff.split(',')[0].trim() || null;
  }
  if (!ipAddress) {
    ipAddress = req.ip || (req.connection && req.connection.remoteAddress) || null;
  }
  const userAgent = req.headers ? req.headers['user-agent'] : null;
  return {
    ipAddress: safeString(ipAddress, 45),
    userAgent: safeString(userAgent, 512),
  };
}

async function upsertDevice(userId, userAgent, ipAddress) {
  try {
    const { deviceName, browser, os } = parseUserAgent(userAgent);

    // Check if device already exists for this user with same IP+browser+os
    const existing = await query(
      `SELECT TOP 1 id, is_current FROM user_devices
       WHERE user_id = @p1 AND ip_address = @p2 AND browser = @p3 AND os = @p4`,
      { p1: userId, p2: ipAddress, p3: browser, p4: os }
    );

    if (existing.recordset.length > 0) {
      const existingDevice = existing.recordset[0];
      // Update existing device to current
      await query(
        `UPDATE user_devices
         SET    is_current = 1,
                last_login_at = SYSUTCDATETIME(),
                user_agent = @p5
         WHERE  id = @p1`,
        { p1: existingDevice.id, p5: userAgent }
      );
      // Only mark OTHER devices of this USER as non-current (not all devices!)
      // Skip if existing device is already current (avoid unnecessary query)
      if (!existingDevice.is_current) {
        await query(
          'UPDATE user_devices SET is_current = 0 WHERE user_id = @p1 AND id != @p2',
          { p1: userId, p2: existingDevice.id }
        );
      }
    } else {
      // First time login on this device/IP/browser/os combination
      // Mark all OLD devices of THIS user as non-current, then insert new device
      await query(
        'UPDATE user_devices SET is_current = 0 WHERE user_id = @p1',
        { p1: userId }
      );
      await query(
        `INSERT INTO user_devices (user_id, device_name, browser, os, ip_address, user_agent, is_current, last_login_at)
         VALUES (@p1, @p2, @p3, @p4, @p5, @p6, 1, SYSUTCDATETIME())`,
        { p1: userId, p2: deviceName, p3: browser, p4: os, p5: ipAddress, p6: userAgent }
      );
    }
  } catch (err) {
    console.error('[loginSessionMiddleware] upsertDevice ERROR:', err.message ? err.message : err);
  }
}

async function logSessionEvent({ sessionId, eventType, userId, userName, ipAddress, userAgent }) {
  try {
    await query(
      `INSERT INTO login_session_events (session_id, event_type, user_id, user_name, ip_address, user_agent)
       VALUES (@p1, @p2, @p3, @p4, @p5, @p6)`,
      {
        p1: sessionId,
        p2: eventType,
        p3: userId || null,
        p4: userName || null,
        p5: ipAddress || null,
        p6: userAgent || null,
      }
    );
  } catch (err) {
    console.error('[loginSessionMiddleware] logSessionEvent failed:', err && err.message ? err.message : err);
  }
}

async function trackLogin(req, user) {
  try {
    const { ipAddress, userAgent } = getRequestMeta(req);
    const { browser, os } = parseUserAgent(userAgent);

    const userId = user && (user.id !== undefined ? user.id : user.user_id) ? user.id : null;
    const userName = safeString(user && (user.user_name || user.name || user.email));
    const phone = safeString(user && user.phone, 32);
    const branchId = user && user.branch_id !== undefined && user.branch_id !== null
      ? user.branch_id
      : null;

    // Chi dong session cua CHINH USER nay (cung user_id)
    // Neu user A login 2 lan -> lan 1 bi kick (logout_reason = 'NEW_LOGIN_OVERRIDE')
    // Neu user A va user B login -> khong anh huong nhau
    if (userId) {
      try {
        await query(
          `UPDATE login_sessions
           SET    logout_time              = SYSUTCDATETIME(),
                  logout_reason            = 'NEW_LOGIN_OVERRIDE',
                  session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
                  status                   = 'ended'
           WHERE  user_id   = @p1
             AND  status   = 'active'
             AND  action_type = 'LOGIN'`,
          { p1: userId }
        );
        console.log(`[trackLogin] Closed previous sessions for userId=${userId}`);

        // Dong device cua user bi kick (chi user hien tai)
        await query(
          'UPDATE user_devices SET is_current = 0 WHERE user_id = @p1',
          { p1: userId }
        );
      } catch (err) {
        console.error('[loginSessionMiddleware] failed to close stale sessions:', err.message);
      }
    }

    // Buoc 4: Insert session moi
    const insertResult = await query(
      `INSERT INTO login_sessions
         (action_type, user_id, user_name, phone, ip_address, user_agent,
          browser, os, branch_id, status, login_time)
       OUTPUT INSERTED.id
       VALUES
         ('LOGIN', @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, 'active', SYSUTCDATETIME())`,
      {
        p1: userId,
        p2: userName,
        p3: phone,
        p4: ipAddress,
        p5: userAgent,
        p6: browser,
        p7: os,
        p8: branchId,
      }
    );

    const sessionId = insertResult.recordset && insertResult.recordset[0] ? insertResult.recordset[0].id : null;

    if (sessionId) {
      await logSessionEvent({
        sessionId,
        eventType: 'LOGIN',
        userId,
        userName,
        ipAddress,
        userAgent,
      });
    }

    // Buoc 5: Update device CHO USER HIEN TAI (chi anh huong device cua user nay)
    // Khong anh huong device cua user khac
    if (userId && ipAddress) {
      await upsertDevice(userId, userAgent, ipAddress);
    }
  } catch (err) {
    console.error('[loginSessionMiddleware] trackLogin failed:', err.message ? err.message : err);
  }
}

async function trackLogout(req) {
  try {
    if (!req || !req.user) {
      console.error('[loginSessionMiddleware] trackLogout skipped: req.user missing');
      return;
    }

    // JWT payload co cac field: userId, email, name (la user_name), roles, branchId
    // Token cu co the chi co userName thay vi name -> chap nhan ca hai.
    const userName = safeString(req.user.name || req.user.user_name);
    const userId = req.user.userId || req.user.id || null;

    if (!userName && !userId) {
      console.error('[loginSessionMiddleware] trackLogout skipped: missing user identifier');
      return;
    }

    const { ipAddress, userAgent } = getRequestMeta(req);

    // Dong session active gan nhat cua user. Uu tien user_id de tranh nham khi
    // user doi ten hien thi (user_name).
    const active = await query(
      `SELECT TOP 1 id, user_id
       FROM   login_sessions
       WHERE  status = 'active' AND action_type = 'LOGIN'
         ${userId ? 'AND user_id = @p2' : 'AND user_name = @p1'}
       ORDER  BY login_time DESC`,
      userId ? { p2: userId } : { p1: userName }
    );

    if (!active.recordset.length) {
      console.warn(`[loginSessionMiddleware] trackLogout: no active session for ${userName || userId}`);
      return;
    }

    const sessionId = active.recordset[0].id;
    const sessionUserId = active.recordset[0].user_id;

    await query(
      `UPDATE login_sessions
       SET    logout_time                = SYSUTCDATETIME(),
              logout_reason              = 'USER_INITIATED',
              session_duration_seconds   = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                     = 'ended'
       WHERE  id = @p1`,
      { p1: sessionId }
    );

    await logSessionEvent({
      sessionId,
      eventType: 'LOGOUT',
      userId: sessionUserId,
      userName,
      ipAddress,
      userAgent,
    });

    // Cap nhat is_current = 0 cho TAT CA device cua user (khong chi device hien tai)
    if (sessionUserId) {
      const devResult = await query(
        'UPDATE user_devices SET is_current = 0 WHERE user_id = @p1 AND is_current = 1',
        { p1: sessionUserId }
      );
      if (devResult.rowsAffected && devResult.rowsAffected[0] > 0) {
        console.log(`[loginSessionMiddleware] Marked ${devResult.rowsAffected[0]} device(s) as inactive for userId=${sessionUserId}`);
      }
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
       OUTPUT INSERTED.id
       VALUES
         ('LOGIN_FAILED', @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, 'failed', SYSUTCDATETIME(), @p9)`,
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

    const sessionId = insertResult.recordset && insertResult.recordset[0] ? insertResult.recordset[0].id : null;
    if (sessionId) {
      await logSessionEvent({
        sessionId,
        eventType: 'LOGIN_FAILED',
        userId,
        userName,
        ipAddress,
        userAgent,
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
  logSessionEvent,
};