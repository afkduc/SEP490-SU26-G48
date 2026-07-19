class MaintenanceReminderRepository {
  async syncFromServiceOrders() {
    throw new Error('Method syncFromServiceOrders() must be implemented');
  }

  async findAll({ branchId, status, search } = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  async markSent(id, { notes } = {}) {
    throw new Error('Method markSent() must be implemented');
  }

  async markConfirmed(id, { confirmedDate, notes } = {}) {
    throw new Error('Method markConfirmed() must be implemented');
  }
}

module.exports = MaintenanceReminderRepository;
