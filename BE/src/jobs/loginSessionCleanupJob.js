/**
 * Job tu dong cleanup cac phien dang nhap stale (khong heartbeat >= 15 phut)
 * va backfill du lieu browser/os cho cac row cu.
 *
 * Chay ngay khi server khoi dong va moi 5 phut.
 *
 * Vi sao can job nay:
 *   - User dong tab / mat ket noi -> khong goi duoc /api/auth/logout
 *   -> phien mac dinh o trang thai 'active' mai mai
 *   - Job se tu dong dong cac phien co last_activity_at < 15 phut truoc
 *     (last_activity_at duoc cap nhat moi 60s qua heartbeat).
 *   - Dong thoi backfill browser/os cho row cu bi NULL (inserted truoc khi fix).
 *
 * THRESHOLD GOC: 24h. VI LY DO:
 *   - Admin logout nhung session van 'active' → visible 24h qua trang "Lich su"
 *   - Cleanup nhat 1h/lan → moi session stale co the ton tai 24-25h.
 *
 * THRESHOLD MOI: 15 phut tu last heartbeat. Job chay moi 5 phut.
 *   → User dong tab khong logout → toi da 20 phut sau session bi close.
 *   → Trang "Lich su" luon phan anh trang thai that (< 20 phut lag).
 */

const { query, executeTransaction } = require('../infrastructure/database/sqlServer');

// Nguong stale: 5 phut khong co heartbeat → session bi close.
// Job chay moi 1 phut → toi da session stale = 6 phut.
// (Cu: 15 phut, chay 5 phut/lan → toi da 20 phut stale → user thay
// "5 phien dang hoat dong" tren man login history trong khi that te
// chi co 1. Giam xuong 5 phut de phan anh trang thai that gan nhat.)
const STALE_MINUTES = parseInt(process.env.LOGIN_SESSION_STALE_MINUTES || '5', 10);
const STALE_HOURS = STALE_MINUTES / 60; // giu tuong thich voi code cu
// Gioi han de tranh CPU lock neu backlog rat lon (millions rows).
// Moi batch update TOP(@p1) rows, sau do delay 1s de DB va event loop thay.
// MAX_ITERATIONS an toan de 1 lan job khong chay qua lau (max ~30 phut).
const BACKFILL_BATCH = 1000;
const BACKFILL_MAX_ITERATIONS = 100; // 100 * 1000 = 100k rows moi lan runAll
const BACKFILL_DELAY_MS = 1000; // delay giua moi batch

async function cleanupStaleSessions() {
  try {
    // QUAN TRONG: dung last_activity_at (cap nhat boi heartbeat moi 60s), KHONG
    // dung login_time. Vi login_time chi cap nhat khi login, con last_activity_at
    // la "lan hoat dong cuoi cung" (heartbeat). Neu user login 1h truoc, van
    // dang dung (heartbeat vua chay) → KHONG close. Neu user dong tab 6 phut
    // truoc → close ngay lap tuc.
    //
    // TRANSACTION: close session + close device cung luc de dam bao rang
    // 2 màn login-history va devices luon dong bo (cu: 2 query rieng le,
    // co the 1 query fail lam 1 màn hien "active" trong khi màn kia da end).
    const result = await executeTransaction(async (txQuery) => {
      const closedSessions = await txQuery(
        `UPDATE login_sessions
         SET    logout_time              = SYSUTCDATETIME(),
                logout_reason            = 'TIMEOUT',
                session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
                status                   = 'ended'
         OUTPUT INSERTED.user_id
         WHERE  status               = 'active'
           AND  action_type          = 'LOGIN'
           AND  COALESCE(last_activity_at, login_time) < DATEADD(MINUTE, -@p1, SYSUTCDATETIME())`,
        { p1: STALE_MINUTES }
      );
      const userIds = [...new Set(
        (closedSessions.recordset || []).map((r) => Number(r.user_id)).filter(Number.isFinite)
      )];
      if (userIds.length > 0) {
        // Dong cac device cua nhung user nay neu is_current=1
        const inClause = userIds.map((_, i) => `@u${i}`).join(',');
        const params = Object.fromEntries(userIds.map((id, i) => [`u${i}`, id]));
        await txQuery(
          `UPDATE user_devices
           SET    is_current = 0
           WHERE  is_current = 1
             AND  user_id IN (${inClause})`,
          params
        );
      }
      return closedSessions.rowsAffected && closedSessions.rowsAffected[0] ? closedSessions.rowsAffected[0] : 0;
    });
    if (result > 0) {
      console.log(`[loginSessionJob] Cleaned ${result} stale sessions + their devices (>= ${STALE_MINUTES} min no heartbeat)`);
    }
  } catch (err) {
    console.error('[loginSessionJob] cleanupStaleSessions failed:', err && err.message ? err.message : err);
  }
}

/**
 * Dong tat ca device co is_current=1 nhung khong co session active nao
 * (hoac session cua no da stale > 15 phut khong heartbeat).
 *
 * Vi du: user bi dong tab, device van la is_current=1 nhung session da
 * bi cleanup job dong roi.
 */
async function cleanupOrphanedDevices() {
  try {
    // Dong bo theo 2 tieu chi:
    //  (a) device is_current=1 nhung khong con session active nao
    //  (b) device is_current=1 nhung session active da stale > 15 phut
    const result = await query(
      `UPDATE ud
       SET    ud.is_current = 0
       FROM   user_devices ud
       WHERE  ud.is_current = 1
         AND (
           NOT EXISTS (
             SELECT 1 FROM login_sessions ls
             WHERE  ls.user_id = ud.user_id
               AND  ls.status = 'active'
               AND  ls.action_type = 'LOGIN'
           )
           OR EXISTS (
             SELECT 1 FROM login_sessions ls
             WHERE  ls.user_id = ud.user_id
               AND  ls.status = 'active'
               AND  ls.action_type = 'LOGIN'
               AND  COALESCE(ls.last_activity_at, ls.login_time) < DATEADD(MINUTE, -@p1, SYSUTCDATETIME())
           )
         )`,
      { p1: STALE_MINUTES }
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
  // Dung iterative loop (khong recursive setImmediate) de:
  //  - Gioi han so iteration (MAX_ITERATIONS) tranh CPU lock khi backlog lon.
  //  - Co the await Promise-based delay giua moi batch -> event loop tho hang.
  //  - Co the break som khi khong con row nao can backfill (affected = 0).
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
    if (affected === 0) break; // Het row can backfill -> dung som

    // Delay giua cac batch de DB va event loop khong bi qua tai.
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
  await cleanupStaleSessions();
  await cleanupOrphanedDevices();
  await backfillLogoutReason();
  await backfillBrowserOs();
}

let timer = null;

function start() {
  // Chay 1 lan ngay khi server start
  setImmediate(runAll);
  // Lap lai moi 1 phut (thay vi 5 phut) → session stale toi da = 5+1=6 phut.
  // Gop ca cleanupStaleSessions + cleanupOrphanedDevices de tranh tinh
  // trang session dong nhung device van "current" (hoac nguoc lai).
  timer = setInterval(runAll, 60 * 1000);
  console.log(`[loginSessionJob] Started - cleanup every 1 minute, stale threshold = ${STALE_MINUTES} min (no heartbeat)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, runAll, cleanupStaleSessions, cleanupOrphanedDevices, backfillBrowserOs, backfillLogoutReason };
