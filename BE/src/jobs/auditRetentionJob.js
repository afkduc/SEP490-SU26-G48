/**
 * Audit Retention Job
 * Chạy mỗi ngày lúc 02:00 sáng.
 * Xóa audit_logs cũ hơn 365 ngày (không archive — bảng audit_logs_archive đã bỏ).
 */
const cron = require('node-cron');
const { query } = require('../infrastructure/database/sqlServer');

async function archiveAndDeleteOldAuditLogs() {
  try {
    console.log('[auditRetentionJob] Starting at', new Date().toISOString());

    const countResult = await query(`
      SELECT COUNT(*) AS total
      FROM audit_logs
      WHERE logged_at < DATEADD(YEAR, -1, GETDATE())
    `);
    const totalToProcess = Number(countResult.recordset[0].total);
    console.log(`[auditRetentionJob] Found ${totalToProcess} old audit logs to delete`);

    if (totalToProcess === 0) {
      console.log('[auditRetentionJob] Nothing to delete. Skipping.');
      return { archived: 0, deleted: 0 };
    }

    const BATCH_SIZE = 1000;
    let totalDeleted = 0;

    while (true) {
      const batchResult = await query(`
        SELECT TOP ${BATCH_SIZE} id
        FROM audit_logs
        WHERE logged_at < DATEADD(YEAR, -1, GETDATE())
        ORDER BY logged_at ASC
      `);

      if (batchResult.recordset.length === 0) break;

      const ids = batchResult.recordset.map((r) => r.id);
      const deleteResult = await query(
        `DELETE FROM audit_logs WHERE id IN (${ids.map((_, i) => `@p${i}`).join(',')})`,
        Object.fromEntries(ids.map((id, i) => [`p${i}`, id]))
      );

      const deleted = Number(deleteResult.rowsAffected?.[0] || 0);
      totalDeleted += deleted;
      console.log(`[auditRetentionJob] Deleted batch: ${batchResult.recordset.length} rows`);

      if (batchResult.recordset.length < BATCH_SIZE) break;
    }

    console.log(`[auditRetentionJob] Done. Deleted ${totalDeleted} rows`);
    return { archived: 0, deleted: totalDeleted };
  } catch (err) {
    console.error('[auditRetentionJob] Error:', err && err.message ? err.message : err);
    throw err;
  }
}

let scheduledTask = null;

function start() {
  if (scheduledTask) {
    console.log('[auditRetentionJob] Already running');
    return;
  }
  scheduledTask = cron.schedule('0 2 * * *', async () => {
    try {
      await archiveAndDeleteOldAuditLogs();
    } catch (err) {
      console.error('[auditRetentionJob] Scheduled run failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh',
  });
  console.log('[auditRetentionJob] Started — running daily at 2:00 AM');
}

function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[auditRetentionJob] Stopped');
  }
}

module.exports = { start, stop, archiveAndDeleteOldAuditLogs };
