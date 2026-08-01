const { query } = require('../database/sqlServer');

const NOTIFICATION_COLUMNS = `
  id,
  user_id,
  title,
  message,
  type,
  severity,
  metadata,
  is_read,
  created_at
`;

function toNotificationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    severity: row.severity || null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

class NotificationRepository {
  /**
   * Tạo notification mới
   */
  async create({ userId, title, message, type, severity = null, metadata = null }) {
    const result = await query(
      `INSERT INTO notifications (user_id, title, message, type, severity, metadata)
       OUTPUT INSERTED.*
       VALUES (@p1, @p2, @p3, @p4, @p5, @p6)`,
      {
        p1: userId,
        p2: title,
        p3: message,
        p4: type,
        p5: severity,
        p6: metadata ? JSON.stringify(metadata) : null,
      }
    );
    return toNotificationRow(result.recordset[0]);
  }

  /**
   * Đánh dấu đã đọc các notification cũ cùng type (chưa đọc) — giữ bản mới nhất.
   */
  async markOlderUnreadOfTypeAsRead(userId, type) {
    if (!userId || !type) return 0;
    const result = await query(
      `UPDATE notifications
       SET is_read = 1
       WHERE user_id = @p1
         AND type = @p2
         AND is_read = 0`,
      { p1: userId, p2: type }
    );
    return result.rowsAffected?.[0] || 0;
  }

  /**
   * Lấy notifications của user với phân trang.
   * Các type dễ spam (thay phiên / IP mới / burst) chỉ giữ 1 bản mới nhất mỗi type.
   */
  async findByUserId(userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
    const offset = (page - 1) * pageSize;

    let baseWhere = 'user_id = @p1';
    if (unreadOnly) {
      baseWhere += ' AND is_read = 0';
    }

    // type spam → gom theo type; type khác → mỗi id là 1 nhóm
    const partitionExpr = `
      CASE
        WHEN type IN (
          N'SESSION_TAKEN_OVER',
          N'SECURITY_SESSION_TAKEOVER',
          N'NEW_DEVICE',
          N'SECURITY_NEW_DEVICE_IP',
          N'SECURITY_FAILED_LOGIN_BURST',
          N'SECURITY_INACTIVE_ADMIN',
          N'LOGIN_FAILED'
        ) THEN type
        ELSE CONCAT(type, N'#', CAST(id AS NVARCHAR(20)))
      END
    `;

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM (
         SELECT id,
                ROW_NUMBER() OVER (PARTITION BY ${partitionExpr} ORDER BY created_at DESC) AS rn
         FROM notifications
         WHERE ${baseWhere}
       ) x WHERE rn = 1`,
      { p1: userId }
    );
    const total = Number(countResult.recordset[0].total) || 0;

    const result = await query(
      `SELECT * FROM (
         SELECT ${NOTIFICATION_COLUMNS},
                ROW_NUMBER() OVER (PARTITION BY ${partitionExpr} ORDER BY created_at DESC) AS rn
         FROM notifications
         WHERE ${baseWhere}
       ) ranked
       WHERE rn = 1
       ORDER BY created_at DESC
       OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY`,
      { p1: userId, p2: offset, p3: pageSize }
    );

    return {
      items: result.recordset.map(toNotificationRow),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Đánh dấu notification đã đọc
   */
  async markAsRead(id, userId) {
    const result = await query(
      `UPDATE notifications SET is_read = 1
       OUTPUT INSERTED.*
       WHERE id = @p1 AND user_id = @p2`,
      { p1: id, p2: userId }
    );
    return toNotificationRow(result.recordset[0]);
  }

  /**
   * Đánh dấu tất cả notifications của user là đã đọc
   */
  async markAllAsRead(userId) {
    await query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = @p1 AND is_read = 0`,
      { p1: userId }
    );
    return true;
  }

  /**
   * Đếm notification chưa đọc (đã gom type spam — mỗi type tối đa 1)
   */
  async getUnreadCount(userId) {
    const partitionExpr = `
      CASE
        WHEN type IN (
          N'SESSION_TAKEN_OVER',
          N'SECURITY_SESSION_TAKEOVER',
          N'NEW_DEVICE',
          N'SECURITY_NEW_DEVICE_IP',
          N'SECURITY_FAILED_LOGIN_BURST',
          N'SECURITY_INACTIVE_ADMIN',
          N'LOGIN_FAILED'
        ) THEN type
        ELSE CONCAT(type, N'#', CAST(id AS NVARCHAR(20)))
      END
    `;
    const result = await query(
      `SELECT COUNT(*) AS count FROM (
         SELECT id,
                ROW_NUMBER() OVER (PARTITION BY ${partitionExpr} ORDER BY created_at DESC) AS rn
         FROM notifications
         WHERE user_id = @p1 AND is_read = 0
       ) x WHERE rn = 1`,
      { p1: userId }
    );
    return result.recordset[0].count;
  }

  /**
   * Lấy notification theo id
   */
  async findById(id) {
    const result = await query(
      `SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE id = @p1`,
      { p1: id }
    );
    return toNotificationRow(result.recordset[0]);
  }
}

module.exports = NotificationRepository;
