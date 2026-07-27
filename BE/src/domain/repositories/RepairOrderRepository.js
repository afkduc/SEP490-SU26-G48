class RepairOrderRepository {
  async findAll({ branchId, teamLeaderId } = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  async findByCode(code) {
    throw new Error('Method findByCode() must be implemented');
  }

  async findByServiceOrderCode(code) {
    throw new Error('Method findByServiceOrderCode() must be implemented');
  }

  async findTeamLeadersByBranch(branchId) {
    throw new Error('Method findTeamLeadersByBranch() must be implemented');
  }

  async findEligibleServiceOrder(serviceOrderId, branchId) {
    throw new Error('Method findEligibleServiceOrder() must be implemented');
  }

  async create(data, { branchId, createdBy }) {
    throw new Error('Method create() must be implemented');
  }

  async updateStatus(id, status) {
    throw new Error('Method updateStatus() must be implemented');
  }

  async updateTaskStatus(taskId, isDone) {
    throw new Error('Method updateTaskStatus() must be implemented');
  }
}

module.exports = RepairOrderRepository;
