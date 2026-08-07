const SecurityAlertRepository = require('../../infrastructure/repositories/SecurityAlertRepository');
const ApiError = require('../../utils/ApiError');

class SecurityAlertService {
  constructor() {
    this.repository = new SecurityAlertRepository();
  }

  async list({ severity, isAcknowledged, page, pageSize, collapsed = true }) {
    return this.repository.findAll({
      severity,
      isAcknowledged,
      page,
      pageSize,
      collapsed: collapsed !== false && collapsed !== 'false',
    });
  }

  async getRelated({ ruleKey, userId, limit }) {
    return this.repository.findRelated({ ruleKey, userId, limit });
  }

  async getCounts() {
    return this.repository.countUnacknowledged();
  }

  async acknowledge(alertId, userId) {
    const alert = await this.repository.findById(alertId);
    if (!alert) throw new ApiError(404, 'Canh bao khong ton tai');
    // Ack cả nhóm trùng (cùng rule + user)
    return this.repository.acknowledgeGroup(alertId, userId);
  }

  async acknowledgeAll(userId) {
    const count = await this.repository.acknowledgeAll(userId);
    return { acknowledgedCount: count };
  }
}

module.exports = SecurityAlertService;
