const { query } = require('../database/sqlServer');

function mapAlertRow(row) {
  let metadata = row.metadata;
  if (typeof metadata === 'string' && metadata.trim()) {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      // giữ nguyên
    }
  }
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    message: row.message,
    userId: row.user_id,
    userName: row.user_name,
    displayName: row.user_first_name && row.user_last_name
      ? `${row.user_first_name} ${row.user_last_name}`
      : row.user_name || null,
    branchId: row.branch_id,
    createdAt: row.created_at,
    isAcknowledged: row.is_acknowledged === 1 || row.is_acknowledged === true,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedByName: row.acknowledged_by_name,
    acknowledgedAt: row.acknowledged_at,
    ruleKey: row.rule_key,
    metadata,
    duplicateCount: row.duplicate_count != null ? Number(row.duplicate_count) : 1,
  };
}

/**
 * Nhóm cảnh báo lặp: cùng rule + user (hoặc cùng rule khi không có user).
 * Bản mới nhất đại diện; duplicate_count = số bản trong nhóm.
 */
const GROUP_KEY_SQL = `
  CONCAT(
    ISNULL(sa.rule_key, N''),
    N'#',
    CASE WHEN sa.user_id IS NULL THEN N'0' ELSE CAST(sa.user_id AS NVARCHAR(20)) END
  )
`;

class SecurityAlertRepository {
  /**
   * Lay alerts voi filter + phan trang.
   * @param {boolean} collapsed - true: chỉ bản mới nhất mỗi nhóm rule+user
   */
  async findAll({ severity, isAcknowledged, page = 1, pageSize = 20, collapsed = true }) {
    const conditions = ['1=1'];
    const params = {};
    let idx = 1;

    if (severity) {
      conditions.push(`sa.severity = @p${idx}`);
      params[`p${idx}`] = severity;
      idx++;
    }

    if (isAcknowledged !== undefined) {
      conditions.push(`sa.is_acknowledged = @p${idx}`);
      params[`p${idx}`] = isAcknowledged ? 1 : 0;
      idx++;
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * pageSize;

    if (!collapsed) {
      const countResult = await query(
        `SELECT COUNT(*) AS total FROM security_alerts sa WHERE ${where}`,
        params
      );

      const dataResult = await query(`
        SELECT
          sa.id, sa.severity, sa.title, sa.message, sa.user_id, sa.branch_id,
          sa.created_at, sa.is_acknowledged, sa.acknowledged_by, sa.acknowledged_at,
          sa.rule_key, sa.metadata,
          u.user_name AS user_name, u.first_name AS user_first_name, u.last_name AS user_last_name,
          ab.user_name AS acknowledged_by_name,
          1 AS duplicate_count
        FROM security_alerts sa
        LEFT JOIN users u ON u.id = sa.user_id
        LEFT JOIN users ab ON ab.id = sa.acknowledged_by
        WHERE ${where}
        ORDER BY sa.created_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `, { ...params, offset, pageSize });

      return {
        items: dataResult.recordset.map(mapAlertRow),
        total: Number(countResult.recordset[0].total),
        page,
        pageSize,
      };
    }

    const countResult = await query(`
      SELECT COUNT(*) AS total FROM (
        SELECT ${GROUP_KEY_SQL} AS grp
        FROM security_alerts sa
        WHERE ${where}
        GROUP BY ${GROUP_KEY_SQL}
      ) g
    `, params);

    const dataResult = await query(`
      SELECT * FROM (
        SELECT
          sa.id, sa.severity, sa.title, sa.message, sa.user_id, sa.branch_id,
          sa.created_at, sa.is_acknowledged, sa.acknowledged_by, sa.acknowledged_at,
          sa.rule_key, sa.metadata,
          u.user_name AS user_name, u.first_name AS user_first_name, u.last_name AS user_last_name,
          ab.user_name AS acknowledged_by_name,
          COUNT(*) OVER (PARTITION BY ${GROUP_KEY_SQL}) AS duplicate_count,
          ROW_NUMBER() OVER (PARTITION BY ${GROUP_KEY_SQL} ORDER BY sa.created_at DESC) AS rn
        FROM security_alerts sa
        LEFT JOIN users u ON u.id = sa.user_id
        LEFT JOIN users ab ON ab.id = sa.acknowledged_by
        WHERE ${where}
      ) ranked
      WHERE rn = 1
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, { ...params, offset, pageSize });

    return {
      items: dataResult.recordset.map(mapAlertRow),
      total: Number(countResult.recordset[0].total),
      page,
      pageSize,
    };
  }

  /**
   * Lịch sử đầy đủ cùng nhóm (rule + user) — dùng trong popup Chi tiết.
   */
  async findRelated({ ruleKey, userId, limit = 50 } = {}) {
    if (!ruleKey) return [];
    const params = { rk: ruleKey, lim: limit };
    let userCond = 'AND user_id IS NULL';
    if (userId != null && userId !== '') {
      userCond = 'AND user_id = @uid';
      params.uid = Number(userId);
    }

    const result = await query(`
      SELECT TOP (@lim)
        sa.id, sa.severity, sa.title, sa.message, sa.user_id, sa.branch_id,
        sa.created_at, sa.is_acknowledged, sa.acknowledged_by, sa.acknowledged_at,
        sa.rule_key, sa.metadata,
        u.user_name AS user_name, u.first_name AS user_first_name, u.last_name AS user_last_name,
        ab.user_name AS acknowledged_by_name,
        1 AS duplicate_count
      FROM security_alerts sa
      LEFT JOIN users u ON u.id = sa.user_id
      LEFT JOIN users ab ON ab.id = sa.acknowledged_by
      WHERE sa.rule_key = @rk
        ${userCond}
      ORDER BY sa.created_at DESC
    `, params);

    return result.recordset.map(mapAlertRow);
  }

  async countUnacknowledged() {
    const result = await query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN t.severity = 'critical' THEN 1 ELSE 0 END) AS criticalCount,
        SUM(CASE WHEN t.severity = 'high' THEN 1 ELSE 0 END) AS highCount,
        SUM(CASE WHEN t.severity = 'medium' THEN 1 ELSE 0 END) AS mediumCount,
        SUM(CASE WHEN t.severity = 'info' THEN 1 ELSE 0 END) AS infoCount
      FROM (
        SELECT severity,
               ROW_NUMBER() OVER (
                 PARTITION BY ISNULL(rule_key, N''),
                   CASE WHEN user_id IS NULL THEN 0 ELSE user_id END
                 ORDER BY created_at DESC
               ) AS rn
        FROM security_alerts
        WHERE is_acknowledged = 0
      ) t
      WHERE t.rn = 1
    `);
    const row = result.recordset[0];
    return {
      total: Number(row.total) || 0,
      critical: Number(row.criticalCount) || 0,
      high: Number(row.highCount) || 0,
      medium: Number(row.mediumCount) || 0,
      info: Number(row.infoCount) || 0,
    };
  }

  async findById(id) {
    const result = await query(`
      SELECT sa.*, u.user_name, u.first_name, u.last_name
      FROM security_alerts sa
      LEFT JOIN users u ON u.id = sa.user_id
      WHERE sa.id = @p1
    `, { p1: id });
    return result.recordset[0] || null;
  }

  async acknowledge(id, acknowledgedBy) {
    await query(
      `UPDATE security_alerts
       SET    is_acknowledged = 1,
              acknowledged_by = @p2,
              acknowledged_at = GETDATE()
       WHERE  id = @p1`,
      { p1: id, p2: acknowledgedBy }
    );
    return this.findById(id);
  }

  /**
   * Ack cả nhóm cùng rule+user với alert id (kèm bản trùng đã gom).
   */
  async acknowledgeGroup(id, acknowledgedBy) {
    const row = await this.findById(id);
    if (!row) return null;

    if (row.user_id != null) {
      await query(
        `UPDATE security_alerts
         SET is_acknowledged = 1,
             acknowledged_by = @p2,
             acknowledged_at = GETDATE()
         WHERE is_acknowledged = 0
           AND rule_key = @rk
           AND user_id = @uid`,
        { p2: acknowledgedBy, rk: row.rule_key, uid: row.user_id }
      );
    } else {
      await query(
        `UPDATE security_alerts
         SET is_acknowledged = 1,
             acknowledged_by = @p2,
             acknowledged_at = GETDATE()
         WHERE is_acknowledged = 0
           AND rule_key = @rk
           AND user_id IS NULL`,
        { p2: acknowledgedBy, rk: row.rule_key }
      );
    }
    return this.findById(id);
  }

  async acknowledgeAll(acknowledgedBy) {
    const result = await query(
      `UPDATE security_alerts
       SET    is_acknowledged = 1,
              acknowledged_by = @p1,
              acknowledged_at = GETDATE()
       WHERE  is_acknowledged = 0`,
      { p1: acknowledgedBy }
    );
    return result.rowsAffected[0];
  }
}

module.exports = SecurityAlertRepository;
