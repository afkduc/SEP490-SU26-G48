const ApiError = require('../../utils/ApiError');
const { buildAuditDescription } = require('../../utils/auditLabels');

class AuditService {
  constructor(auditRepository) {
    this.auditRepository = auditRepository;
  }

  /**
   * Alias gon cho insertAuditLog - nhieu controller dang goi this.auditService.log().
   * Giu ten cu de tuong thich nguoc, ngoai ra cung cap insertAuditLog() cho
   * code cu.
   *
   * Auto-map field alias de tuong thich voi nhieu controller dang goi voi
   * ten field khac nhau:
   *   - actorEmail / actorName / actorUserName -> user_name
   *   - resource / resourceType -> table_name
   *   - actorId -> user_id
   */
  async log(logData) {
    if (!logData || typeof logData !== 'object') {
      throw new ApiError(400, 'logData la bat buoc');
    }

    const normalized = { ...logData };
    if (!normalized.user_name) {
      normalized.user_name = normalized.actorEmail || normalized.actorName || normalized.actorUserName || null;
    }
    if (!normalized.table_name) {
      normalized.table_name = normalized.resource || normalized.resourceType || 'unknown';
    }
    if (!normalized.user_id && normalized.actorId) {
      normalized.user_id = normalized.actorId;
    }
    // Map common request aliases used by controllers
    if (!normalized.ip_address && (normalized.ip || normalized.ipAddress)) {
      normalized.ip_address = normalized.ip || normalized.ipAddress;
    }
    if (!normalized.record_id && normalized.resourceId != null) {
      normalized.record_id = String(normalized.resourceId);
    }
    if (!normalized.request_url && normalized.userAgent) {
      // keep userAgent available in description if no dedicated column write
      if (!normalized.description) {
        normalized.description = `UA: ${String(normalized.userAgent).slice(0, 120)}`;
      }
    }
    // Map details -> new_value / description để FE hiển thị được
    if (normalized.details && !normalized.new_value) {
      normalized.new_value = typeof normalized.details === 'string'
        ? normalized.details
        : JSON.stringify(normalized.details);
    }
    if (!normalized.description && normalized.details) {
      const d = typeof normalized.details === 'string'
        ? (() => { try { return JSON.parse(normalized.details); } catch { return null; } })()
        : normalized.details;
      if (d && typeof d === 'object') {
        const built = buildAuditDescription(normalized.action, d);
        if (built) normalized.description = built;
      }
    } else if (!normalized.description && normalized.action) {
      normalized.description = buildAuditDescription(normalized.action, {});
    }

    // Truncate action for safety (some DBs historically used short action columns)
    if (normalized.action && String(normalized.action).length > 50) {
      normalized.action = String(normalized.action).slice(0, 50);
    }

    return this.insertAuditLog(normalized);
  }

  async insertAuditLog(logData) {
    if (!logData || typeof logData !== 'object') {
      throw new ApiError(400, 'logData la bat buoc');
    }

    const { user_name, action, table_name } = logData;

    if (!user_name || !action || !table_name) {
      throw new ApiError(400, 'user_name, action, table_name la bat buoc');
    }

    return this.auditRepository.insertAuditLog({
      ...logData,
      user_name,
      action,
      table_name,
    });
  }

  async getAuditLogs(filters = {}) {
    const { page, pageSize } = filters;

    const parsedPage = parseInt(page, 10) || 1;
    const parsedPageSize = parseInt(pageSize, 10) || 10;

    if (parsedPage < 1) {
      throw new ApiError(400, 'page phai >= 1');
    }
    if (parsedPageSize < 1 || parsedPageSize > 100) {
      throw new ApiError(400, 'pageSize phai tu 1 den 100');
    }

    return this.auditRepository.getAuditLogs({
      ...filters,
      excludeAuthEvents: Boolean(filters.excludeAuthEvents),
      page: parsedPage,
      pageSize: parsedPageSize,
    });
  }

  async getAuditLogById(id) {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId) || parsedId < 1) {
      throw new ApiError(400, 'id khong hop le');
    }

    const log = await this.auditRepository.getAuditLogById(parsedId);
    if (!log) {
      throw new ApiError(404, 'Khong tim thay audit log');
    }

    return log;
  }

  async exportAuditLogs(filters = {}) {
    return this.auditRepository.getAuditLogsForExport({
      keyword: filters.keyword,
      userName: filters.userName,
      phone: filters.phone,
      action: filters.action,
      tableName: filters.tableName,
      entityName: filters.entityName,
      entityCode: filters.entityCode,
      ipAddress: filters.ipAddress,
      requestMethod: filters.requestMethod,
      responseStatus: filters.responseStatus,
      startDate: filters.startDate,
      endDate: filters.endDate,
      branchId: filters.branchId,
      excludeAuthEvents: Boolean(filters.excludeAuthEvents),
    });
  }

  async getLoginSessions(filters = {}) {
    const { page, pageSize } = filters;

    const parsedPage = parseInt(page, 10) || 1;
    const parsedPageSize = parseInt(pageSize, 10) || 10;

    if (parsedPage < 1) {
      throw new ApiError(400, 'page phai >= 1');
    }
    if (parsedPageSize < 1 || parsedPageSize > 100) {
      throw new ApiError(400, 'pageSize phai tu 1 den 100');
    }

    return this.auditRepository.getLoginSessions({
      ...filters,
      page: parsedPage,
      pageSize: parsedPageSize,
    });
  }

  async exportLoginSessions(filters = {}) {
    return this.auditRepository.getLoginSessions({
      ...filters,
      page: 1,
      pageSize: 5000,
    });
  }

  async getLoginSessionsSince(since, limit = 50) {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 1000);
    if (Number.isNaN(sinceDate.getTime())) {
      throw new ApiError(400, 'since phai la ISO date hoac unix ms');
    }
    const parsedLimit = parseInt(limit, 10) || 50;
    if (parsedLimit < 1 || parsedLimit > 200) {
      throw new ApiError(400, 'limit phai tu 1 den 200');
    }
    const items = await this.auditRepository.getLoginSessionsSince(sinceDate, parsedLimit);
    return { items, since: sinceDate.toISOString(), serverTime: new Date().toISOString() };
  }

  async getEntityDefinitions() {
    return this.auditRepository.getEntityDefinitions();
  }

  async getAuditLogsByUser(userId, limit) {
    if (!userId) {
      throw new ApiError(400, 'userId la bat buoc');
    }

    const parsedLimit = limit === undefined || limit === null ? 50 : parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new ApiError(400, 'limit phai tu 1 den 100');
    }

    return this.auditRepository.getAuditLogsByUser(Number(userId), parsedLimit);
  }
}

module.exports = AuditService;
