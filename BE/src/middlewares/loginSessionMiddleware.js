const { query } = require('../infrastructure/database/sqlServer');

function safeString(value, max = 255) {
  if (value === undefined || value === null) return null;
  const str = String(value);
  return str.length > max ? str.substring(0, max) : str;
}

function getRequestMeta(req) {
  const ipAddress = req.ip || (req.connection && req.connection.remoteAddress) || null;
  const userAgent = req.headers ? req.headers['user-agent'] : null;
  return {
    ipAddress: safeString(ipAddress, 64),
    userAgent: safeString(userAgent, 512),
  };
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
};