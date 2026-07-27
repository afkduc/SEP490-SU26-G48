/**
 * Job tu dong cleanup cac phien dang nhap stale (khong heartbeat)
 * va backfill du lieu browser/os cho cac row cu.
 *
 * Chay ngay khi server khoi dong va moi 1 phut.
 *
 * QUAN TRONG (bug da fix):
 *   Khi dong session stale, KHONG duoc set is_current=0 cho TAT CA device
 *   cua user neu user van con session active khac. Truoc day lam dung vay
 *   → admin dang dung app nhung man Thiet bi / Lich su hien "da dang xuat".
 */

const { query, executeTransaction } = require('../infrastructure/database/sqlServer');

// Nguong stale: khong heartbeat → coi la dong tab. Mac dinh 30 phut
// (an toan hon 5 phut khi heartbeat/API loi tam thoi).
const STALE_MINUTES = parseInt(process.env.LOGIN_SESSION_STALE_MINUTES || '30', 10);
const BACKFILL_BATCH = 1000;
const BACKFILL_MAX_ITERATIONS = 100;
const BACKFILL_DELAY_MS = 1000;

async function cleanupStaleSessions() {
  try {
    const result = await executeTransaction(async (txQuery) => {
      const closedSessions = await txQuery(
        `UPDATE login_sessions
         SET    logout_time              = SYSUTCDATETIME(),
                logout_reason            = 'TIMEOUT',
                session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
                status                   = 'ended'
         OUTPUT INSERTED.user_id, INSERTED.device_id
         WHERE  status               = 'active'
           AND  action_type          = 'LOGIN'
           AND  COALESCE(last_activity_at, login_time) < DATEADD(MINUTE, -@p1, SYSUTCDATETIME())`,
        { p1: STALE_MINUTES }
      );

      const rows = closedSessions.recordset || [];
      const userIds = [...new Set(
        rows.map((r) => Number(r.user_id)).filter(Number.isFinite)
      )];
      const deviceIds = [...new Set(
        rows.map((r) => Number(r.device_id)).filter(Number.isFinite)
      )];

      // Chi tat device khi user KHONG CON session active nao.
      // Neu van con session live → giu is_current (tranh mat trang thai dang hoat dong).
      if (userIds.length > 0) {
        const inClause = userIds.map((_, i) => `@u${i}`).join(',');
        const params = Object.fromEntries(userIds.map((id, i) => [`u${i}`, id]));
        await txQuery(
          `UPDATE user_devices
           SET    is_current = 0
           WHERE  is_current = 1
             AND  user_id IN (${inClause})
             AND  NOT EXISTS (
               SELECT 1
               FROM   login_sessions ls
               WHERE  ls.user_id = user_devices.user_id
                 AND  ls.status = 'active'
                 AND  ls.action_type = 'LOGIN'
             )`,
          params
        );
      }

      // Neu session stale gan device_id cu the va user khong con session live
      // → dam bao device do cung tat (phong truong hop user_id NULL).
      if (deviceIds.length > 0) {
        const inDev = deviceIds.map((_, i) => `@d${i}`).join(',');
        const params = Object.fromEntries(deviceIds.map((id, i) => [`d${i}`, id]));
        await txQuery(
          `UPDATE user_devices
           SET    is_current = 0
           WHERE  id IN (${inDev})
             AND  is_current = 1
             AND  NOT EXISTS (
               SELECT 1
               FROM   login_sessions ls
               WHERE  ls.user_id = user_devices.user_id
                 AND  ls.status = 'active'
                 AND  ls.action_type = 'LOGIN'
             )`,
          params
        );
      }

      return rows.length;
    });
    if (result > 0) {
      console.log(`[loginSessionJob] Cleaned ${result} stale sessions (>= ${STALE_MINUTES} min no heartbeat)`);
    }
  } catch (err) {
    console.error('[loginSessionJob] cleanupStaleSessions failed:', err && err.message ? err.message : err);
  }
}

/**
 * Tat device is_current=1 khi user khong con session active nao.
 * KHONG tat device chi vi ton tai 1 session stale khac (bug cu).
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

/**
 * Heal: neu user dang co session active gan device_id ma device bi is_current=0
 * (do bug cleanup cu) → bat lai is_current=1.
 */
async function healActiveDevices() {
  try {
    const result = await query(
      `UPDATE ud
       SET    ud.is_current = 1,
              ud.last_activity_at = COALESCE(ud.last_activity_at, SYSUTCDATETIME())
       FROM   user_devices ud
       INNER JOIN login_sessions ls
               ON ls.device_id = ud.id
              AND ls.user_id = ud.user_id
              AND ls.status = 'active'
              AND ls.action_type = 'LOGIN'
       WHERE  ud.is_current = 0`
    );
    const affected = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
    if (affected > 0) {
      console.log(`[loginSessionJob] Healed ${affected} device(s) still tied to active sessions`);
    }
  } catch (err) {
    console.error('[loginSessionJob] healActiveDevices failed:', err && err.message ? err.message : err);
  }
}

/**
 * Heal session active nhung status hien "ended" tren UI do lech device:
 * khong can — session status la nguon that. Chi heal device o tren.
 *
 * Them: neu session active nhung last_activity_at null → set = login_time
 * de tranh bi timeout ngay lap tuc.
 */
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

async function runAll() {
  await healSessionActivityTimestamp();
  await cleanupStaleSessions();
  await cleanupOrphanedDevices();
  await healActiveDevices();
  await backfillLogoutReason();
  await backfillBrowserOs();
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
  cleanupOrphanedDevices,
  healActiveDevices,
  backfillBrowserOs,
  backfillLogoutReason,
};
