const { query } = require('../database/sqlServer');

class SecurityAlertRepository {
  /**
   * Lay tat ca alerts voi filter + phan trang
   */
  async findAll({ severity, isAcknowledged, page = 1, pageSize = 20 }) {
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

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM security_alerts sa WHERE ${where}`,
      params
    );

    const dataResult = await query(`
      SELECT TOP 500
        sa.id,
        sa.severity,
        sa.title,
        sa.message,
        sa.user_id,
        sa.branch_id,
        sa.created_at,
        sa.is_acknowledged,
        sa.acknowledged_by,
        sa.acknowledged_at,
        sa.rule_key,
        sa.metadata,
        u.user_name AS user_name,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        ab.user_name AS acknowledged_by_name
      FROM security_alerts sa
      LEFT JOIN users u ON u.id = sa.user_id
      LEFT JOIN users ab ON ab.id = sa.acknowledged_by
      WHERE ${where}
      ORDER BY sa.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, { ...params, offset, pageSize });

    const items = dataResult.recordset.map((row) => ({
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
      metadata: row.metadata,
    }));

    return {
      items,
      total: Number(countResult.recordset[0].total),
      page,
      pageSize,
    };
  }

  /**
   * Dem alerts chua doc theo severity
   */
  async countUnacknowledged() {
    const result = await query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS criticalCount,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS highCount,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) AS mediumCount,
        SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) AS infoCount
      FROM security_alerts
      WHERE is_acknowledged = 0
    `);
    const row = result.recordset[0];
    return {
      total: Number(row.total),
      critical: Number(row.criticalCount),
      high: Number(row.highCount),
      medium: Number(row.mediumCount),
      info: Number(row.infoCount),
    };
  }

  /**
   * Lay chi tiet 1 alert
   */
  async findById(id) {
    const result = await query(`
      SELECT sa.*, u.user_name, u.first_name, u.last_name
      FROM security_alerts sa
      LEFT JOIN users u ON u.id = sa.user_id
      WHERE sa.id = @p1
    `, { p1: id });
    return result.recordset[0] || null;
  }

  /**
   * Acknowledge 1 alert
   */
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
   * Acknowledge all unacknowledged alerts
   */
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
