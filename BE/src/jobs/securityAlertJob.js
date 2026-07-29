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
  SESSION_TAKEOVER: 'session_takeover',
};

/** Map rule_key → notification event type (chuông thông báo đồng bộ panel cảnh báo). */
const RULE_TO_NOTIF = {
  [RULE_KEYS.FAILED_LOGIN_BURST]: 'SECURITY_FAILED_LOGIN_BURST',
  [RULE_KEYS.NEW_ADMIN_ROLE]: 'SECURITY_NEW_ADMIN_ROLE',
  [RULE_KEYS.INACTIVE_ADMIN]: 'SECURITY_INACTIVE_ADMIN',
  [RULE_KEYS.NEW_DEVICE_IP]: 'SECURITY_NEW_DEVICE_IP',
  [RULE_KEYS.SESSION_TAKEOVER]: 'SECURITY_SESSION_TAKEOVER',
};

const SEVERITY_TO_NOTIF = {
  critical: 'critical',
  high: 'error',
  medium: 'warning',
  info: 'info',
};

let notificationService = null;
function getNotificationService() {
  if (!notificationService) {
    const NotificationService = require('../application/services/NotificationService');
    notificationService = new NotificationService();
  }
  return notificationService;
}

/**
 * Insert 1 security alert
 *
 * Neu bang security_alerts chua ton tai (chua chay migration V6) hoac
 * loi DB -> chi log 1 LAN, KHONG spam log moi 5 phut. Migration V6 se
 * tao bang security_alerts.
 */
const DB_MISSING_RE = /Invalid object name 'security_alerts'|'security_alerts' not found/i;
let lastMissingLogTs = 0;

/**
 * Deduplication:
 * - forceNew=false (cron): nếu đã có alert chưa ack cùng nhóm → bỏ qua (không insert/notify lại).
 * - forceNew=true (realtime takeover/burst): ack bản cũ rồi ghi bản mới + notify 1 lần.
 * - severity=info: chỉ ghi panel cảnh báo, không đẩy chuông admin (tránh spam “IP mới”).
 */
async function insertAlert({
  severity,
  title,
  message,
  userId,
  branchId,
  ruleKey,
  metadata,
  fingerprint,
  forceNew = false,
}) {
  try {
    const fp = fingerprint
      || (metadata && (metadata.ipAddress || metadata.ip))
      || null;

    // Nhóm: rule + user + fingerprint (IP) nếu có
    let existsParams = { rk: ruleKey };
    let existsSql = `
      SELECT TOP 1 id FROM security_alerts
      WHERE rule_key = @rk AND is_acknowledged = 0
    `;
    if (userId) {
      existsSql += ' AND user_id = @uid';
      existsParams.uid = userId;
    } else {
      existsSql += ' AND user_id IS NULL';
    }
    if (fp) {
      existsSql += ' AND metadata LIKE @fpLike';
      existsParams.fpLike = `%${fp}%`;
    }

    if (ruleKey) {
      const existing = await query(existsSql, existsParams);
      if (existing.recordset?.length && !forceNew) {
        return false;
      }

      if (existing.recordset?.length && forceNew) {
        if (userId) {
          if (fp) {
            await query(`
              UPDATE security_alerts
              SET is_acknowledged = 1,
                  acknowledged_at = SYSUTCDATETIME()
              WHERE user_id = @uid
                AND rule_key = @rk
                AND is_acknowledged = 0
                AND metadata LIKE @fpLike
            `, { uid: userId, rk: ruleKey, fpLike: `%${fp}%` });
          } else {
            await query(`
              UPDATE security_alerts
              SET is_acknowledged = 1,
                  acknowledged_at = SYSUTCDATETIME()
              WHERE user_id = @uid
                AND rule_key = @rk
                AND is_acknowledged = 0
            `, { uid: userId, rk: ruleKey });
          }
        } else if (fp) {
          await query(`
            UPDATE security_alerts
            SET is_acknowledged = 1,
                acknowledged_at = SYSUTCDATETIME()
            WHERE rule_key = @rk
              AND user_id IS NULL
              AND is_acknowledged = 0
              AND metadata LIKE @fpLike
          `, { rk: ruleKey, fpLike: `%${fp}%` });
        } else {
          await query(`
            UPDATE security_alerts
            SET is_acknowledged = 1,
                acknowledged_at = SYSUTCDATETIME()
            WHERE rule_key = @rk
              AND user_id IS NULL
              AND is_acknowledged = 0
          `, { rk: ruleKey });
        }
      }
    }

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

    // Chỉ chuông cho Critical/High (brute-force, takeover, gán admin...).
    // Info + Medium inactive_admin: chỉ panel cảnh báo — tránh spam chuông.
    if (
      severity === 'info'
      || ruleKey === RULE_KEYS.INACTIVE_ADMIN
    ) {
      return true;
    }

    try {
      const eventType = RULE_TO_NOTIF[ruleKey] || 'SECURITY_ALERT';
      await getNotificationService().notifyAdmins(
        eventType,
        {
          title,
          message,
          severity: SEVERITY_TO_NOTIF[severity] || severity || 'warning',
          ruleKey,
          metadata: {
            ...(metadata || {}),
            ruleKey,
            alertSeverity: severity,
            relatedUserId: userId || null,
            branchId: branchId || null,
          },
        },
        { excludeUserId: null }
      );
    } catch (notifErr) {
      console.warn(
        '[securityAlertJob] notifyAdmins failed (alert đã lưu):',
        notifErr && notifErr.message ? notifErr.message : notifErr
      );
    }

    return true;
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
    return false;
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
        fingerprint: String(row.ip_address || ''),
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
 * Rule 3 (MEDIUM): Admin không có hoạt động 30 ngày.
 * Chỉ ghi panel cảnh báo (không chuông). Tối đa 1 alert / admin / 30 ngày.
 */
async function checkInactiveAdmin() {
  try {
    const result = await query(`
      SELECT TOP 10 u.id, u.user_name, u.email,
             (
               SELECT MAX(t.last_at)
               FROM (
                 SELECT al.logged_at AS last_at
                 FROM audit_logs al
                 WHERE al.user_id = u.id
                 UNION ALL
                 SELECT ls.login_time AS last_at
                 FROM login_sessions ls
                 WHERE ls.user_id = u.id
                   AND ls.action_type = 'LOGIN'
               ) t
             ) AS last_action_at
      FROM users u
      JOIN user_role ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.role_name = 'admin'
        AND u.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM login_sessions ls_active
          WHERE ls_active.user_id = u.id
            AND ls_active.status = 'active'
            AND ls_active.action_type = 'LOGIN'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM (
            SELECT al2.user_id, al2.logged_at AS last_at
            FROM audit_logs al2
            UNION ALL
            SELECT ls2.user_id, ls2.login_time AS last_at
            FROM login_sessions ls2
            WHERE ls2.action_type = 'LOGIN'
          ) recent
          WHERE recent.user_id = u.id
            AND recent.last_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
        )
        -- Đã báo trong 30 ngày (kể cả đã xem) → không spam lại
        AND NOT EXISTS (
          SELECT 1 FROM security_alerts sa
          WHERE sa.rule_key = N'inactive_admin'
            AND sa.user_id = u.id
            AND sa.created_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
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
        forceNew: false,
        metadata: { lastActionAt: row.last_action_at, userName: row.user_name, email: row.email },
      });
    }
  } catch (err) {
    console.error('[securityAlertJob] checkInactiveAdmin failed:', err && err.message ? err.message : err);
  }
}

/**
 * Rule 4 (INFO): Login từ IP mới (chưa từng thấy trong 30 ngày).
 * Chỉ ghi panel — không spam chuông. Bỏ qua session đã có alert / máy tin cậy.
 */
async function checkNewDeviceIp() {
  try {
    const result = await query(`
      SELECT TOP 20 ls.id, ls.user_id, ls.ip_address, ls.login_time, u.user_name
      FROM login_sessions ls
      JOIN users u ON u.id = ls.user_id
      WHERE ls.action_type = 'LOGIN'
        AND ls.login_time >= DATEADD(HOUR, -6, GETDATE())
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
        -- Đã có alert chưa xử lý cùng user+IP → không tạo lại
        AND NOT EXISTS (
          SELECT 1 FROM security_alerts sa
          WHERE sa.rule_key = N'new_device_ip'
            AND sa.is_acknowledged = 0
            AND sa.user_id = ls.user_id
            AND sa.metadata LIKE N'%' + ls.ip_address + N'%'
        )
        -- Máy đã tin cậy (cùng browser+os) → không cảnh báo IP mới
        AND NOT EXISTS (
          SELECT 1 FROM user_devices ud
          WHERE ud.user_id = ls.user_id
            AND ud.is_trusted = 1
            AND ud.browser = ls.browser
            AND ud.os = ls.os
        )
      ORDER BY ls.login_time DESC
    `);

    for (const row of result.recordset) {
      await insertAlert({
        severity: 'info',
        title: 'Đăng nhập từ thiết bị mới',
        message: `User "${row.user_name}" đăng nhập từ thiết bị mới (IP ${row.ip_address}).`,
        userId: row.user_id,
        branchId: null,
        ruleKey: RULE_KEYS.NEW_DEVICE_IP,
        fingerprint: String(row.ip_address || ''),
        forceNew: false,
        metadata: {
          ipAddress: row.ip_address,
          userName: row.user_name,
          loginTime: row.login_time,
          sessionId: row.id,
        },
      });
    }
  } catch (err) {
    console.error('[securityAlertJob] checkNewDeviceIp failed:', err && err.message ? err.message : err);
  }
}

/**
 * Gọi realtime khi sai mật khẩu đạt ngưỡng (≥5) — không chờ cron 30 phút.
 */
async function raiseFailedLoginBurstAlert({ ipAddress, count, identifier } = {}) {
  const ip = ipAddress || 'unknown';
  const cnt = Number(count) || 0;
  if (cnt < 5) return false;
  return insertAlert({
    severity: 'high',
    title: 'Nhiều lần đăng nhập thất bại',
    message: `IP ${ip} có ${cnt} lần đăng nhập thất bại liên tiếp${identifier ? ` (tài khoản: ${identifier})` : ''}. Có thể là tấn công brute-force.`,
    userId: null,
    branchId: null,
    ruleKey: RULE_KEYS.FAILED_LOGIN_BURST,
    fingerprint: String(ip),
    forceNew: true,
    metadata: { ipAddress: ip, count: cnt, identifier: identifier || null },
  });
}

/**
 * Gọi realtime khi thiết bị B đăng nhập thay phiên thiết bị A (cùng tài khoản).
 * Rule new_device_ip không bắt được 2 browser cùng IP localhost.
 */
async function raiseSessionTakeoverAlert({
  userId,
  userName,
  ip,
  browser,
  os,
  newSessionId,
} = {}) {
  if (!userId) return false;
  const deviceLabel = [browser, os].filter(Boolean).join(' · ') || 'Thiết bị khác';
  const location = ip || 'IP không xác định';
  const name = userName || `user#${userId}`;
  return insertAlert({
    severity: 'high',
    title: 'Đăng nhập trên thiết bị khác',
    message: `Tài khoản "${name}" vừa đăng nhập từ thiết bị khác (${deviceLabel}, ${location}). Phiên cũ trên thiết bị trước đó đã bị đăng xuất.`,
    userId,
    branchId: null,
    ruleKey: RULE_KEYS.SESSION_TAKEOVER,
    fingerprint: String(userId),
    forceNew: true,
    metadata: {
      ipAddress: ip || null,
      userName: name,
      browser: browser || null,
      os: os || null,
      sessionId: newSessionId || null,
    },
  });
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
  // Backup quét mỗi 5 phút; sự kiện quan trọng đã raise realtime khi login fail / takeover
  scheduledTask = cron.schedule('*/5 * * * *', runAllRules, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh',
  });
  console.log('[securityAlertJob] Started — running every 5 minutes (+ realtime on login events)');
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

module.exports = {
  start,
  stop,
  runAllRules,
  raiseFailedLoginBurstAlert,
  raiseSessionTakeoverAlert,
  RULE_KEYS,
};
