// services/permissionMatrixSyncService.js
//
// Auto-sync L1 (screen:X:Y:access) theo L2 (role_screen_permissions)
// cho TAT CA role. Chay ngam khi server boot, idempotent, safe to re-run.
//
// Muc dich:
//   - Dam bao moi thanh vien trong team khong can chay SQL thu cong
//   - Tu dong dong bo L1 neu developer moi clone code va chay local
//   - Co the chay lai nhieu lan ma khong gay duplicate (NOT EXISTS check)
//
// Quy tac:
//   - L2 active (>= 1 action = 1) + chua co L1 permission key -> INSERT
//   - L2 active + chua co L1 grant -> GRANT (insert role_permissions)
//   - L2 = all false (hoac khong co row) + dang co L1 grant -> REVOKE

const { getPool } = require('../../infrastructure/database/sqlServer');

let _isRunning = false;
let _lastSyncAt = null;
let _lastSyncResult = null;
let _intervalHandle = null;

const SYNC_INTERVAL_MS = 3000;

/**
 * Chay sync L1 <-> L2. Idempotent, khong anh huong neu data da sync.
 * Tra ve { success, permsCreated, granted, revoked, durationMs }.
 */
async function syncL1ByL2() {
  if (_isRunning) {
    console.log('[PermissionMatrixSync] Skip - already running');
    return { skipped: true };
  }
  _isRunning = true;
  const t0 = Date.now();

  try {
    const pool = await getPool();

    // BUOC 1: Insert L1 permission keys moi cho cac screen_key chua co
    const r1 = await pool.request().query(`
      INSERT INTO permissions (permission_key, description, created_at)
      SELECT
          CAST('screen:' + rsp.screen_key + ':access' AS NVARCHAR(500)) AS permission_key,
          'Auto-generated L1 access permission for screen ' + rsp.screen_key AS description,
          GETDATE() AS created_at
      FROM role_screen_permissions rsp
      WHERE NOT EXISTS (
          SELECT 1 FROM permissions p
          WHERE p.permission_key COLLATE database_default
              = CAST('screen:' + rsp.screen_key + ':access' AS NVARCHAR(500)) COLLATE database_default
      )
      GROUP BY rsp.screen_key
    `);

    // BUOC 2: Grant L1 theo L2 active (insert role_permissions)
    const r2 = await pool.request().query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT DISTINCT
          rsp.role_id,
          p.id AS permission_id
      FROM role_screen_permissions rsp
      JOIN permissions p
          ON p.permission_key COLLATE database_default
           = CAST('screen:' + rsp.screen_key + ':access' AS NVARCHAR(500)) COLLATE database_default
      WHERE (rsp.can_view = 1
          OR rsp.can_create = 1
          OR rsp.can_update = 1
          OR rsp.can_delete = 1
          OR rsp.can_export = 1)
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = rsp.role_id
                AND rp.permission_id = p.id
          )
    `);

    // BUOC 3: Revoke L1 khong khop L2 (delete role_permissions)
    const r3 = await pool.request().query(`
      DELETE rp
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_key LIKE 'screen:%:access'
        AND NOT EXISTS (
            SELECT 1
            FROM role_screen_permissions rsp
            WHERE rsp.role_id = rp.role_id
              AND CAST('screen:' + rsp.screen_key + ':access' AS NVARCHAR(500))
                  COLLATE database_default
                  = p.permission_key COLLATE database_default
              AND (rsp.can_view = 1
                  OR rsp.can_create = 1
                  OR rsp.can_update = 1
                  OR rsp.can_delete = 1
                  OR rsp.can_export = 1)
        )
    `);

    const result = {
      success: true,
      permsCreated: r1.rowsAffected[0],
      granted: r2.rowsAffected[0],
      revoked: r3.rowsAffected[0],
      durationMs: Date.now() - t0,
    };
    _lastSyncAt = new Date();
    _lastSyncResult = result;

    const hasChange = result.permsCreated || result.granted || result.revoked;
    if (hasChange) {
      console.log(
        `[PermissionMatrixSync] Changed: +${result.permsCreated} perms, +${result.granted} grants, -${result.revoked} grants (${result.durationMs}ms)`
      );
    } else {
      console.log(`[PermissionMatrixSync] In sync (${result.durationMs}ms)`);
    }

    return result;
  } catch (err) {
    console.error('[PermissionMatrixSync] Failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    _isRunning = false;
  }
}

/**
 * Chay sync khi server boot (khong block startup).
 * Sau do start interval moi 3s de thay the trigger DB (da drop).
 */
function bootSync() {
  if (_intervalHandle) {
    console.log('[PermissionMatrixSync] Already started - skipping');
    return;
  }
  // Lan dau chay sau 3s de cho DB connection san sang
  setTimeout(() => {
    syncL1ByL2().catch((err) => {
      console.error('[PermissionMatrixSync] Boot sync crashed:', err.message);
    });
  }, 3000);

  // Sau do chay dinh ky moi 3s (thay the trigger DB da drop)
  _intervalHandle = setInterval(() => {
    syncL1ByL2().catch((err) => {
      console.error('[PermissionMatrixSync] Interval sync crashed:', err.message);
    });
  }, SYNC_INTERVAL_MS);

  console.log(`[PermissionMatrixSync] Started - sync every ${SYNC_INTERVAL_MS / 1000}s`);
}

/**
 * Stop interval (dung cho graceful shutdown / tests).
 */
function stopSync() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
    console.log('[PermissionMatrixSync] Stopped');
  }
}

/**
 * Lay trang thai sync (dung cho debug / health check).
 */
function getSyncStatus() {
  return {
    isRunning: _isRunning,
    lastSyncAt: _lastSyncAt,
    lastSyncResult: _lastSyncResult,
  };
}

module.exports = {
  syncL1ByL2,
  bootSync,
  stopSync,
  getSyncStatus,
};