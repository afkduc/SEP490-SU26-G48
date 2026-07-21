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
   * Lấy notifications của user với phân trang
   */
  async findByUserId(userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE user_id = @p1';
    if (unreadOnly) {
      whereClause += ' AND is_read = 0';
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
      { p1: userId }
    );
    const total = countResult.recordset[0].total;

    const result = await query(
      `SELECT ${NOTIFICATION_COLUMNS}
       FROM   notifications
       ${whereClause}
       ORDER BY created_at DESC
       OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY`,
      { p1: userId, p2: offset, p3: pageSize }
    );

    return {
      items: result.recordset.map(toNotificationRow),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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
   * Đếm notification chưa đọc
   */
  async getUnreadCount(userId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = @p1 AND is_read = 0`,
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
