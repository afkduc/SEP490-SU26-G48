const ApiError = require('../../utils/ApiError');

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
