/**
 * Job tu dong cleanup cac phien dang nhap stale (>= 24 gio chua logout)
 * va backfill du lieu browser/os cho cac row cu.
 *
 * Chay ngay khi server khoi dong va moi 1 gio.
 *
 * Vi sao can job nay:
 *   - User dong tab / mat ket noi -> khong goi duoc /api/auth/logout
 *   -> phien mac dinh o trang thai 'active' mai mai
 *   - Job se tu dong dong cac phien > 24h voi logout_reason = 'TIMEOUT'
 *   - Dong thoi backfill browser/os cho row cu bi NULL (inserted truoc khi fix)
 */

const { query } = require('../infrastructure/database/sqlServer');

const STALE_HOURS = parseInt(process.env.LOGIN_SESSION_STALE_HOURS || '24', 10);
const BACKFILL_BATCH = 1000;

async function cleanupStaleSessions() {
  try {
    const result = await query(
      `UPDATE login_sessions
       SET    logout_time              = DATEADD(HOUR, @p1, login_time),
              logout_reason            = 'TIMEOUT',
              session_duration_seconds = @p1 * 3600,
              status                   = 'ended'
       WHERE  status = 'active'
         AND  action_type = 'LOGIN'
         AND  login_time  < DATEADD(HOUR, -@p1, SYSUTCDATETIME())`,
      { p1: STALE_HOURS }
    );
    const affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    if (affected > 0) {
      console.log(`[loginSessionJob] Cleaned ${affected} stale sessions (>= ${STALE_HOURS}h)`);
    }
  } catch (err) {
    console.error('[loginSessionJob] cleanupStaleSessions failed:', err && err.message ? err.message : err);
  }
}

/**
 * Dong tat ca device co is_current=1 nhung user khong co session active nao.
 * Vi du: user bi dong tab, device van la is_current=1 nhung session da
 * bi cleanup job dong roi.
 */
async function cleanupOrphanedDevices() {
  try {
    const result = await query(
      `UPDATE ud
       SET    ud.is_current = 0
       FROM   user_devices ud
       WHERE  ud.is_current = 1
         AND  NOT EXISTS (
           SELECT 1 FROM login_sessions ls
           WHERE  ls.user_id = ud.user_id
             AND  ls.status = 'active'
             AND  ls.action_type = 'LOGIN'
         )`
    );
    const affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    if (affected > 0) {
      console.log(`[loginSessionJob] Marked ${affected} orphaned device(s) as inactive`);
    }
  } catch (err) {
    console.error('[loginSessionJob] cleanupOrphanedDevices failed:', err && err.message ? err.message : err);
  }
}

async function backfillBrowserOs(limit = BACKFILL_BATCH) {
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
    const affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    if (affected > 0) {
      console.log(`[loginSessionJob] Backfilled ${affected} rows browser/os`);
      // Tiep tuc cho den khi het
      setImmediate(() => backfillBrowserOs(limit));
    }
  } catch (err) {
    console.error('[loginSessionJob] backfillBrowserOs failed:', err && err.message ? err.message : err);
  }
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

async function runAll() {
  await cleanupStaleSessions();
  await cleanupOrphanedDevices();
  await backfillLogoutReason();
  await backfillBrowserOs();
}

let timer = null;

function start() {
  // Chay 1 lan ngay khi server start
  setImmediate(runAll);
  // Lap lai moi 1h
  timer = setInterval(runAll, 60 * 60 * 1000);
  console.log('[loginSessionJob] Started - cleanup every 60 minutes, stale threshold = ' + STALE_HOURS + 'h');
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, runAll, cleanupStaleSessions, cleanupOrphanedDevices, backfillBrowserOs, backfillLogoutReason };
