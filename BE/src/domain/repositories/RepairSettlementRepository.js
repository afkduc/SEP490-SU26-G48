class RepairSettlementRepository {
  async findAll({ branchId, status, search, page = 1, limit = 20 } = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  async count({ branchId, status, search } = {}) {
    throw new Error('Method count() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  async findActiveByCustomerVehicle(customerId, vehicleId, excludeId) {
    throw new Error('Method findActiveByCustomerVehicle() must be implemented');
  }

  async findPublicHistoryByVehicleIdentifier(identifier) {
    throw new Error('Method findPublicHistoryByVehicleIdentifier() must be implemented');
  }

  async create(data, { branchId, advisorId }) {
    throw new Error('Method create() must be implemented');
  }

  async update(id, data) {
    throw new Error('Method update() must be implemented');
  }

  async wouldLoseCompletedTasks(newItems) {
    throw new Error('Method wouldLoseCompletedTasks() must be implemented');
  }

  async updateStatus(id, status, { issuedBy } = {}) {
    throw new Error('Method updateStatus() must be implemented');
  }

  async findGatePending(branchId) {
    throw new Error('Method findGatePending() must be implemented');
  }

  async confirmGateExit(id, branchId) {
    throw new Error('Method confirmGateExit() must be implemented');
  }

  async createPayosTransaction(repairOrderId, { orderCode, paymentLinkId, qrCode, checkoutUrl, amount, expiredAt }) {
    throw new Error('Method createPayosTransaction() must be implemented');
  }

  async findPayosTransactionByOrderCode(orderCode) {
    throw new Error('Method findPayosTransactionByOrderCode() must be implemented');
  }

  async markPayosTransactionPaid(orderCode, { reference, paidAt }) {
    throw new Error('Method markPayosTransactionPaid() must be implemented');
  }

  async setNgDecision(repairOrderId, taskId, { decision, note, userId }) {
    throw new Error('Method setNgDecision() must be implemented');
  }

  async acquireLock(id, userId) {
    throw new Error('Method acquireLock() must be implemented');
  }

  async releaseLock(id, userId) {
    throw new Error('Method releaseLock() must be implemented');
  }
}

module.exports = RepairSettlementRepository;
