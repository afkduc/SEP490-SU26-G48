const ApiError = require('../../utils/ApiError');

class AuditService {
  constructor(auditRepository) {
    this.auditRepository = auditRepository;
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

  async exportAuditLogs(filters = {}) {
    return this.auditRepository.getAuditLogsForExport({
      userName: filters.userName,
      phone: filters.phone,
      action: filters.action,
      entityName: filters.entityName,
      entityCode: filters.entityCode,
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
