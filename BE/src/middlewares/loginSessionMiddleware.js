const { query } = require('../infrastructure/database/sqlServer');

function safeString(value, max = 255) {
  if (value === undefined || value === null) return null;
  const str = String(value);
  return str.length > max ? str.substring(0, max) : str;
}

function parseUserAgent(userAgent) {
  if (!userAgent) return { deviceName: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  const ua = userAgent.toLowerCase();

  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opr/')) browser = 'Opera';

  const deviceName = `${browser} on ${os}`;
  return { deviceName: safeString(deviceName, 255), browser: safeString(browser, 100), os: safeString(os, 100) };
}

function getRequestMeta(req) {
  const ipAddress = req.ip || (req.connection && req.connection.remoteAddress) || null;
  const userAgent = req.headers ? req.headers['user-agent'] : null;
  return {
    ipAddress: safeString(ipAddress, 64),
    userAgent: safeString(userAgent, 512),
  };
}

async function upsertDevice(userId, userAgent, ipAddress) {
  try {
    const { deviceName, browser, os } = parseUserAgent(userAgent);

    await query(
      'UPDATE user_devices SET is_current = 0 WHERE user_id = @p1',
      { p1: userId }
    );

    const existing = await query(
      `SELECT TOP 1 id FROM user_devices
       WHERE user_id = @p1 AND ip_address = @p2 AND browser = @p3 AND os = @p4`,
      { p1: userId, p2: ipAddress, p3: browser, p4: os }
    );

    if (existing.recordset.length > 0) {
      await query(
        `UPDATE user_devices
         SET    is_current = 1,
                last_login_at = GETDATE(),
                user_agent = @p5
         WHERE  id = @p1`,
        { p1: existing.recordset[0].id, p5: userAgent }
      );
    } else {
      await query(
        `INSERT INTO user_devices (user_id, device_name, browser, os, ip_address, user_agent, is_current, last_login_at)
         VALUES (@p1, @p2, @p3, @p4, @p5, @p6, 1, GETDATE())`,
        { p1: userId, p2: deviceName, p3: browser, p4: os, p5: ipAddress, p6: userAgent }
      );
    }
  } catch (err) {
    console.error('[loginSessionMiddleware] upsertDevice failed:', err && err.message ? err.message : err);
  }
}

async function trackLogin(req, user) {
  try {
    const { ipAddress, userAgent } = getRequestMeta(req);

    const userId = user && (user.id !== undefined ? user.id : user.user_id) ? user.id : null;
    const userName = safeString(user && (user.user_name || user.name || user.email));
    const phone = safeString(user && user.phone, 32);
    const branchId = user && user.branch_id !== undefined && user.branch_id !== null
      ? user.branch_id
      : null;

    await query(
      `INSERT INTO login_sessions
         (action_type, user_id, user_name, phone, ip_address, user_agent, branch_id, status)
       VALUES
         ('LOGIN', @p1, @p2, @p3, @p4, @p5, @p6, 'active')`,
      {
        p1: userId,
        p2: userName,
        p3: phone,
        p4: ipAddress,
        p5: userAgent,
        p6: branchId,
      }
    );

    if (userId && ipAddress) {
      await upsertDevice(userId, userAgent, ipAddress);
    }
  } catch (err) {
    console.error('[loginSessionMiddleware] trackLogin failed:', err && err.message ? err.message : err);
  }
}

async function trackLogout(req) {
  try {
    if (!req || !req.user || !req.user.user_name) {
      console.error('[loginSessionMiddleware] trackLogout skipped: req.user.user_name missing');
      return;
    }

    const userName = safeString(req.user.user_name);

    await query(
      `UPDATE login_sessions
       SET    logout_time                = GETDATE(),
              session_duration_seconds   = DATEDIFF(SECOND, login_time, GETDATE()),
              status                     = 'ended'
       WHERE  user_name = @p1
         AND  status    = 'active'
         AND  action_type = 'LOGIN'
         AND  login_time  = (
               SELECT TOP 1 login_time
               FROM   login_sessions
               WHERE  user_name   = @p1
                 AND  status      = 'active'
                 AND  action_type = 'LOGIN'
               ORDER BY login_time DESC
             )`,
      { p1: userName }
    );

    if (req.user && req.user.id) {
      await query(
        'UPDATE user_devices SET is_current = 0 WHERE user_id = @p1 AND is_current = 1',
        { p1: req.user.id }
      );
    }
  } catch (err) {
    console.error('[loginSessionMiddleware] trackLogout failed:', err && err.message ? err.message : err);
  }
}

async function trackLoginFailed(req, identifier) {
  try {
    const { ipAddress, userAgent } = getRequestMeta(req);
    const userName = safeString(identifier);

    await query(
      `INSERT INTO login_sessions
         (action_type, user_id, user_name, phone, ip_address, user_agent, branch_id, status)
       VALUES
         ('LOGIN_FAILED', NULL, @p1, NULL, @p2, @p3, NULL, 'failed')`,
      {
        p1: userName,
        p2: ipAddress,
        p3: userAgent,
      }
    );
  } catch (err) {
    console.error('[loginSessionMiddleware] trackLoginFailed failed:', err && err.message ? err.message : err);
  }
}

module.exports = {
  trackLogin,
  trackLogout,
  trackLoginFailed,
  upsertDevice,
};
