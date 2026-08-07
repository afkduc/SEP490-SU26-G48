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

  async findEligibleServiceOrder(serviceOrderId, branchId) {
    throw new Error('Method findEligibleServiceOrder() must be implemented');
  }

  // Tho tu nhan viec qua khoang xe (xem VehicleBayService) - tra ve null neu
  // phieu vua bi khoang khac nhan truoc (thua race).
  async claim(serviceOrderId, { branchId, teamLeaderId, bayId, createdBy }) {
    throw new Error('Method claim() must be implemented');
  }

  async searchTechnicians(teamLeaderId, branchId, search) {
    throw new Error('Method searchTechnicians() must be implemented');
  }

  async setTechnicians(id, teamLeaderId, branchId, technicianIds) {
    throw new Error('Method setTechnicians() must be implemented');
  }

  async updateStatus(id, status) {
    throw new Error('Method updateStatus() must be implemented');
  }

  async updateTaskStatus(taskId, isDone) {
    throw new Error('Method updateTaskStatus() must be implemented');
  }
}

module.exports = RepairOrderRepository;
