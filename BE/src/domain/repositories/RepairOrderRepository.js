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

  async findPublicProgressByCode(code) {
    throw new Error('Method findPublicProgressByCode() must be implemented');
  }

  async findEligibleRepairOrder(repairOrderId, branchId) {
    throw new Error('Method findEligibleRepairOrder() must be implemented');
  }

  // Tho tu nhan viec qua khoang xe (xem VehicleBayService) - tra ve null neu
  // phieu vua bi khoang khac nhan truoc (thua race).
  async claim(repairOrderId, { branchId, teamLeaderId, bayId, createdBy }) {
    throw new Error('Method claim() must be implemented');
  }

  async searchTechnicians(teamLeaderId, branchId, search) {
    throw new Error('Method searchTechnicians() must be implemented');
  }

  async setTechnicians(id, teamLeaderId, branchId, technicianIds) {
    throw new Error('Method setTechnicians() must be implemented');
  }

  async reopenTask(repairOrderId, taskId) {
    throw new Error('Method reopenTask() must be implemented');
  }

  async reportBayCompleted(id) {
    throw new Error('Method reportBayCompleted() must be implemented');
  }

  async updateStatus(id, status) {
    throw new Error('Method updateStatus() must be implemented');
  }

  async updateTaskStatus(taskId, isDone, { checkResult, checkNote } = {}) {
    throw new Error('Method updateTaskStatus() must be implemented');
  }
}

module.exports = RepairOrderRepository;
