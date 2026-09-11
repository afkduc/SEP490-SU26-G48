/**
 * Job tu dong cleanup cac phien dang nhap stale (khong heartbeat)
 * va backfill du lieu browser/os cho cac row cu.
 *
 * Thiet bi = login_sessions (da gop bo user_devices).
 */

const { query } = require('../infrastructure/database/sqlServer');
const { emitLoginSessionEvent } = require('../application/events/LoginSessionEvents');

const STALE_MINUTES = parseInt(process.env.LOGIN_SESSION_STALE_MINUTES || '30', 10);
const BACKFILL_BATCH = 1000;
const BACKFILL_MAX_ITERATIONS = 100;
const BACKFILL_DELAY_MS = 1000;

async function cleanupStaleSessions() {
  try {
    const closedSessions = await query(
      `UPDATE login_sessions
       SET    logout_time              = SYSUTCDATETIME(),
              logout_reason            = 'TIMEOUT',
              session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                   = 'ended'
       OUTPUT INSERTED.id AS session_id,
              INSERTED.user_id,
              INSERTED.ip_address,
              INSERTED.browser,
              INSERTED.os
       WHERE  status               = 'active'
         AND  action_type          = 'LOGIN'
         AND  COALESCE(last_activity_at, login_time) < DATEADD(MINUTE, -@p1, SYSUTCDATETIME())`,
      { p1: STALE_MINUTES }
    );

    const closedRows = closedSessions.recordset || [];
    if (closedRows.length > 0) {
      console.log(`[loginSessionJob] Cleaned ${closedRows.length} stale sessions (>= ${STALE_MINUTES} min no heartbeat)`);

      const nameByUser = new Map();
      const uidList = [...new Set(closedRows.map((r) => Number(r.user_id)).filter(Number.isFinite))];
      if (uidList.length > 0) {
        try {
          const inU = uidList.map((_, i) => `@n${i}`).join(',');
          const nparams = Object.fromEntries(uidList.map((id, i) => [`n${i}`, id]));
          const names = await query(
            `SELECT id, user_name, first_name, last_name
             FROM users WHERE id IN (${inU})`,
            nparams
          );
          for (const u of names.recordset || []) {
            const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
            nameByUser.set(Number(u.id), full || u.user_name || `user#${u.id}`);
          }
        } catch (e) {
          console.warn('[loginSessionJob] load user names for SSE failed:', e.message);
        }
      }

      for (const row of closedRows) {
        const uid = Number(row.user_id);
        const sid = row.session_id || null;
        emitLoginSessionEvent('logout', {
          userId: uid || null,
          userName: nameByUser.get(uid) || null,
          sessionId: sid,
          deviceId: sid,
          ipAddress: row.ip_address || null,
          browser: row.browser || null,
          os: row.os || null,
          reason: 'TIMEOUT',
        });
      }
    }
  } catch (err) {
    console.error('[loginSessionJob] cleanupStaleSessions failed:', err && err.message ? err.message : err);
  }
}

async function healSessionActivityTimestamp() {
  try {
    const result = await query(
      `UPDATE login_sessions
       SET    last_activity_at = login_time
       WHERE  status = 'active'
         AND  action_type = 'LOGIN'
         AND  last_activity_at IS NULL
         AND  login_time IS NOT NULL`
    );
    const affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    if (affected > 0) {
      console.log(`[loginSessionJob] Backfilled last_activity_at for ${affected} active session(s)`);
    }
  } catch (err) {
    console.error('[loginSessionJob] healSessionActivityTimestamp failed:', err && err.message ? err.message : err);
  }
}

async function backfillBrowserOs(limit = BACKFILL_BATCH) {
  const start = Date.now();
  let total = 0;
  for (let i = 0; i < BACKFILL_MAX_ITERATIONS; i++) {
    let affected = 0;
    try {
      const result = await query(
        `UPDATE TOP (@p1) login_sessions
         SET    browser = CASE
                         WHEN user_agent LIKE '%Edg/%'   THEN 'Edge'
                         WHEN user_agent LIKE '%Firefox/%' THEN 'Firefox'
                         WHEN user_agent LIKE '%OPR/%'    THEN 'Opera'
                         WHEN user_agent LIKE '%Chrome/%' THEN 'Chrome'
                         WHEN user_agent LIKE '%Safari/%' THEN 'Safari'
                         ELSE 'Unknown'
                       END,
                os      = CASE
                         WHEN user_agent LIKE '%Windows%'  THEN 'Windows'
                         WHEN user_agent LIKE '%Android%'  THEN 'Android'
                         WHEN user_agent LIKE '%iPhone%' OR user_agent LIKE '%iPad%' THEN 'iOS'
                         WHEN user_agent LIKE '%Mac OS%' OR user_agent LIKE '%Macintosh%' THEN 'macOS'
                         WHEN user_agent LIKE '%Linux%'    THEN 'Linux'
                         ELSE 'Unknown'
                       END
         WHERE  browser IS NULL OR os IS NULL`,
        { p1: limit }
      );
      affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    } catch (err) {
      console.error('[loginSessionJob] backfillBrowserOs failed:', err && err.message ? err.message : err);
      return total;
    }

    total += affected;
    if (affected === 0) break;
    await new Promise((r) => setTimeout(r, BACKFILL_DELAY_MS));
  }

  const elapsed = Date.now() - start;
  if (total > 0) {
    console.log(`[loginSessionJob] Backfilled ${total} rows browser/os in ${elapsed}ms`);
  }
  return total;
}

async function backfillLogoutReason() {
  try {
    const result = await query(
      `UPDATE login_sessions
       SET    logout_reason = 'USER_INITIATED'
       WHERE  status = 'ended' AND logout_reason IS NULL`
    );
    const affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    if (affected > 0) {
      console.log(`[loginSessionJob] Backfilled ${affected} rows logout_reason`);
    }
  } catch (err) {
    console.error('[loginSessionJob] backfillLogoutReason failed:', err && err.message ? err.message : err);
  }
}

async function backfillDeviceName() {
  try {
    const result = await query(
      `UPDATE login_sessions
       SET    device_name = CONCAT(ISNULL(browser, N'Unknown'), N' on ', ISNULL(os, N'Unknown'))
       WHERE  device_name IS NULL
         AND  action_type = 'LOGIN'
         AND  (browser IS NOT NULL OR os IS NOT NULL)`
    );
    const affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    if (affected > 0) {
      console.log(`[loginSessionJob] Backfilled ${affected} rows device_name`);
    }
  } catch (err) {
    // Cot device_name chua co — ensureSessionDeviceSchema se them luc boot
    if (!/Invalid column name 'device_name'/i.test(err.message || '')) {
      console.error('[loginSessionJob] backfillDeviceName failed:', err && err.message ? err.message : err);
    }
  }
}

async function runAll() {
  await healSessionActivityTimestamp();
  await cleanupStaleSessions();
  await backfillLogoutReason();
  await backfillBrowserOs();
  await backfillDeviceName();
}

let timer = null;

function start() {
  setImmediate(runAll);
  timer = setInterval(runAll, 60 * 1000);
  console.log(`[loginSessionJob] Started - cleanup every 1 minute, stale threshold = ${STALE_MINUTES} min (no heartbeat)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  start,
  stop,
  runAll,
  cleanupStaleSessions,
  cleanupOrphanedDevices: async () => {},
  healActiveDevices: async () => {},
  backfillBrowserOs,
  backfillLogoutReason,
};
