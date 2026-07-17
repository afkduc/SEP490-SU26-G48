const SecurityAlertRepository = require('../../infrastructure/repositories/SecurityAlertRepository');
const ApiError = require('../../utils/ApiError');

class SecurityAlertService {
  constructor() {
    this.repository = new SecurityAlertRepository();
  }

  async list({ severity, isAcknowledged, page, pageSize }) {
    return this.repository.findAll({ severity, isAcknowledged, page, pageSize });
  }

  async getCounts() {
    return this.repository.countUnacknowledged();
  }

  async acknowledge(alertId, userId) {
    const alert = await this.repository.findById(alertId);
    if (!alert) throw new ApiError(404, 'Canh bao khong ton tai');
    return this.repository.acknowledge(alertId, userId);
  }

  async acknowledgeAll(userId) {
    const count = await this.repository.acknowledgeAll(userId);
    return { acknowledgedCount: count };
  }
}

module.exports = SecurityAlertService;
