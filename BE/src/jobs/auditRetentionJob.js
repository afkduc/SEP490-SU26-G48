/**
 * Audit Retention Job
 * Chạy mỗi ngày lúc 02:00 sáng.
 * - Archive audit_logs cũ hơn 365 ngày sang audit_logs_archive
 * - Xóa audit_logs cũ hơn 365 ngày
 */
const cron = require('node-cron');
const { query } = require('../infrastructure/database/sqlServer');

async function archiveAndDeleteOldAuditLogs() {
  try {
    console.log('[auditRetentionJob] Starting at', new Date().toISOString());

    // Dem rows de archive
    const countResult = await query(`
      SELECT COUNT(*) AS total
      FROM audit_logs
      WHERE logged_at < DATEADD(YEAR, -1, GETDATE())
    `);
    const totalToProcess = Number(countResult.recordset[0].total);
    console.log(`[auditRetentionJob] Found ${totalToProcess} old audit logs to archive`);

    if (totalToProcess === 0) {
      console.log('[auditRetentionJob] Nothing to archive. Skipping.');
      return { archived: 0, deleted: 0 };
    }

    // Archive 1000 rows mỗi lần để tránh lock lâu
    const BATCH_SIZE = 1000;
    let totalArchived = 0;

    while (true) {
      const batchResult = await query(`
        SELECT TOP ${BATCH_SIZE}
          id, action, user_id, user_name, table_name, record_id,
          old_value, new_value, ip_address, user_agent, response_status, logged_at
        FROM audit_logs
        WHERE logged_at < DATEADD(YEAR, -1, GETDATE())
        ORDER BY logged_at ASC
      `);

      if (batchResult.recordset.length === 0) break;

      for (const row of batchResult.recordset) {
        try {
          await query(
            `INSERT INTO audit_logs_archive
               (action, user_id, user_name, table_name, record_id, old_value, new_value,
                ip_address, user_agent, response_status, logged_at)
             VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11)`,
            {
              p1: row.action, p2: row.user_id, p3: row.user_name,
              p4: row.table_name, p5: row.record_id,
              p6: row.old_value, p7: row.new_value,
              p8: row.ip_address, p9: row.user_agent,
              p10: row.response_status, p11: row.logged_at,
            }
          );
        } catch (insertErr) {
          console.error('[auditRetentionJob] Archive insert error:', insertErr.message);
        }
      }

      // Xoa batch vua archive
      const ids = batchResult.recordset.map((r) => r.id);
      const deleteResult = await query(
        `DELETE FROM audit_logs WHERE id IN (${ids.map((_, i) => `@p${i}`).join(',')})`,
        Object.fromEntries(ids.map((id, i) => [`p${i}`, id]))
      );

      totalArchived += deleteResult.rowsAffected[0];
      console.log(`[auditRetentionJob] Archived batch: ${batchResult.recordset.length} rows`);

      if (batchResult.recordset.length < BATCH_SIZE) break;
    }

    console.log(`[auditRetentionJob] Done. Archived ${totalArchived} rows`);
    return { archived: totalArchived, deleted: totalArchived };
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
  // Run every day at 2:00 AM (Asia/Ho_Chi_Minh)
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
