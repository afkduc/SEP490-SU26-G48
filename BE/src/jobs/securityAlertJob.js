/**
 * Security Alert Job
 * Chạy mỗi 5 phút bằng node-cron.
 * Quét các rule bảo mật và ghi vào bảng security_alerts.
 */
const cron = require('node-cron');
const { query } = require('../infrastructure/database/sqlServer');
const config = require('../config');

const RULE_KEYS = {
  FAILED_LOGIN_BURST: 'failed_login_burst',
  NEW_ADMIN_ROLE: 'new_admin_role',
  INACTIVE_ADMIN: 'inactive_admin',
  NEW_DEVICE_IP: 'new_device_ip',
};

/**
 * Insert 1 security alert
 *
 * Neu bang security_alerts chua ton tai (chua chay migration V6) hoac
 * loi DB -> chi log 1 LAN, KHONG spam log moi 5 phut. Migration V6 se
 * tao bang security_alerts.
 */
const DB_MISSING_RE = /Invalid object name 'security_alerts'|'security_alerts' not found/i;
let lastMissingLogTs = 0;

async function insertAlert({ severity, title, message, userId, branchId, ruleKey, metadata }) {
  try {
    await query(
      `INSERT INTO security_alerts (severity, title, message, user_id, branch_id, rule_key, metadata)
       VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7)`,
      {
        p1: severity,
        p2: title,
        p3: message,
        p4: userId || null,
        p5: branchId || null,
        p6: ruleKey,
        p7: metadata ? JSON.stringify(metadata) : null,
      }
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    // Bang/thieu cot -> chi log 1 lan moi 30 phut (tranh spam console)
    const isMissing = DB_MISSING_RE.test(msg);
    if (isMissing) {
      const now = Date.now();
      if (now - lastMissingLogTs > 30 * 60_000) {
        console.warn('[securityAlertJob] Bang security_alerts chua ton tai - hay chay Database/migrations/V6__add_security_devices_notification.sql.');
        lastMissingLogTs = now;
      }
    } else {
      console.error('[securityAlertJob] insertAlert failed:', msg);
    }
  }
}

/**
 * Rule 1 (HIGH): > 5 lần LOGIN_FAILED trong 15 phút gần đây từ cùng 1 IP
 */
async function checkFailedLoginBurst() {
  try {
    const result = await query(`
      SELECT ip_address, COUNT(*) AS cnt
      FROM login_sessions
      WHERE action_type = 'LOGIN_FAILED'
        AND login_time >= DATEADD(MINUTE, -15, SYSUTCDATETIME())
      GROUP BY ip_address
      HAVING COUNT(*) >= 5
    `);

    for (const row of result.recordset) {
      await insertAlert({
        severity: 'high',
        title: 'Nhiều lần đăng nhập thất bại',
        message: `IP ${row.ip_address} có ${row.cnt} lần đăng nhập thất bại trong 15 phút qua. Có thể là tấn công brute-force.`,
        userId: null,
        branchId: null,
        ruleKey: RULE_KEYS.FAILED_LOGIN_BURST,
        metadata: { ipAddress: row.ip_address, count: row.cnt },
      });
    }
  } catch (err) {
    console.error('[securityAlertJob] checkFailedLoginBurst failed:', err && err.message ? err.message : err);
  }
}

/**
 * Rule 2 (CRITICAL): user vừa được cấp role admin
 *
 * Bug cu (da fix):
 *   - user_role KHONG co cot created_at (chi co id/user_id/role_id/is_active).
 *   - Code cu query `u.created_at >= DATEADD(HOUR, -24, GETDATE())` -> filter theo
 *     ngay tao user, KHONG theo ngay gan role -> false negative khi user cu
 *     moi duoc promote len admin.
 *
 * Fix: dung audit_logs de detect role assignment gan day (audit log da co san
 * cot logged_at + table_name='user_role'). Logic:
 *   1. Lay cac audit_logs INSERT user_role trong 24h gan day.
 *   2. Lay user_role hien tai (is_active=1) match admin role.
 *   3. JOIN de lay chi tiet user de gui alert.
 */
async function checkNewAdminRole() {
  try {
    const ADMIN_ROLE_NAME = 'admin';
    const result = await query(
      `
      SELECT TOP 10 al.id            AS audit_id,
             al.logged_at          AS role_assigned_at,
             al.user_id            AS changed_by,
             ur.user_id            AS target_user_id,
             u.user_name           AS target_user_name,
             u.email               AS target_email,
             r.role_name
      FROM   audit_logs al
      JOIN   user_role ur ON ur.id = al.record_id
      JOIN   users u      ON u.id = ur.user_id
      JOIN   roles r      ON r.id = ur.role_id
      WHERE  al.table_name = 'user_role'
        AND  al.action     IN ('INSERT', 'UPDATE')
        AND  r.role_name   = @p1
        AND  al.logged_at  >= DATEADD(HOUR, -24, SYSUTCDATETIME())
      ORDER BY al.logged_at DESC
      `,
      { p1: ADMIN_ROLE_NAME }
    );

    for (const row of result.recordset) {
      await insertAlert({
        severity: 'critical',
        title: 'Phân quyền Admin mới',
        message:
          `User "${row.target_user_name}" (${row.target_email}) vừa được cấp quyền Admin.`,
        userId: row.target_user_id,
        branchId: null,
        ruleKey: RULE_KEYS.NEW_ADMIN_ROLE,
        metadata: {
          userName: row.target_user_name,
          email: row.target_email,
          assignedAt: row.role_assigned_at,
          changedBy: row.changed_by,
          auditId: row.audit_id,
        },
      });
    }
  } catch (err) {
    console.error(
      '[securityAlertJob] checkNewAdminRole failed:',
      err && err.message ? err.message : err
    );
  }
}

/**
 * Rule 3 (MEDIUM): Admin không có action trong audit_logs 30 ngày
 */
async function checkInactiveAdmin() {
  try {
    const result = await query(`
      SELECT TOP 10 u.id, u.user_name, u.email,
             (SELECT TOP 1 al.logged_at
              FROM audit_logs al
              WHERE al.user_id = u.id
              ORDER BY al.logged_at DESC) AS last_action_at
      FROM users u
      JOIN user_role ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.role_name = 'admin'
        AND u.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM audit_logs al2
          WHERE al2.user_id = u.id
            AND al2.logged_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
        )
    `);

    for (const row of result.recordset) {
      await insertAlert({
        severity: 'medium',
        title: 'Admin không hoạt động',
        message: `Admin "${row.user_name}" (${row.email}) không có hoạt động nào trong 30 ngày gần đây.`,
        userId: row.id,
        branchId: null,
        ruleKey: RULE_KEYS.INACTIVE_ADMIN,
        metadata: { lastActionAt: row.last_action_at },
      });
    }
  } catch (err) {
    console.error('[securityAlertJob] checkInactiveAdmin failed:', err && err.message ? err.message : err);
  }
}

/**
 * Rule 4 (INFO): Login từ IP mới (chưa từng thấy trong 30 ngày)
 */
async function checkNewDeviceIp() {
  try {
    const result = await query(`
      SELECT TOP 20 ls.id, ls.user_id, ls.ip_address, ls.login_time, u.user_name
      FROM login_sessions ls
      JOIN users u ON u.id = ls.user_id
      WHERE ls.action_type = 'LOGIN'
        AND ls.login_time >= DATEADD(HOUR, -24, GETDATE())
        AND NOT EXISTS (
          SELECT 1 FROM login_sessions ls2
          WHERE ls2.user_id = ls.user_id
            AND ls2.ip_address = ls.ip_address
            AND ls2.login_time < DATEADD(DAY, -30, GETDATE())
            AND ls2.id != ls.id
        )
        AND EXISTS (
          SELECT 1 FROM login_sessions ls3
          WHERE ls3.user_id = ls.user_id
            AND ls3.ip_address != ls.ip_address
            AND ls3.action_type = 'LOGIN'
        )
      ORDER BY ls.login_time DESC
    `);

    for (const row of result.recordset) {
      await insertAlert({
        severity: 'info',
        title: 'Đăng nhập từ IP mới',
        message: `User "${row.user_name}" đăng nhập từ IP mới ${row.ip_address}.`,
        userId: row.user_id,
        branchId: null,
        ruleKey: RULE_KEYS.NEW_DEVICE_IP,
        metadata: { ipAddress: row.ip_address, userName: row.user_name, loginTime: row.login_time },
      });
    }
  } catch (err) {
    console.error('[securityAlertJob] checkNewDeviceIp failed:', err && err.message ? err.message : err);
  }
}

async function runAllRules() {
  console.log('[securityAlertJob] Running all security rules at', new Date().toISOString());
  await Promise.all([
    checkFailedLoginBurst(),
    checkNewAdminRole(),
    checkInactiveAdmin(),
    checkNewDeviceIp(),
  ]);
  console.log('[securityAlertJob] Done at', new Date().toISOString());
}

let scheduledTask = null;

function start() {
  if (scheduledTask) {
    console.log('[securityAlertJob] Already running');
    return;
  }
  // Run every 5 minutes
  scheduledTask = cron.schedule('*/5 * * * *', runAllRules, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh',
  });
  console.log('[securityAlertJob] Started — running every 5 minutes');
}

function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[securityAlertJob] Stopped');
  }
}

// Run immediately on start (once)
runAllRules().catch((e) => console.error('[securityAlertJob] Initial run error:', e));

module.exports = { start, stop, runAllRules };
