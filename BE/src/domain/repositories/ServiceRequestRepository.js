class ServiceRequestRepository {
  async create(data) {
    throw new Error('Method create() must be implemented');
  }

  async findByBranch(branchId, { status } = {}) {
    throw new Error('Method findByBranch() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  async acceptAtomic(id, userId) {
    throw new Error('Method acceptAtomic() must be implemented');
  }

  async countPendingByBranch(branchId) {
    throw new Error('Method countPendingByBranch() must be implemented');
  }

  async createAppointment(serviceRequestId, data, createdBy) {
    throw new Error('Method createAppointment() must be implemented');
  }

  async updateAppointment(appointmentId, data) {
    throw new Error('Method updateAppointment() must be implemented');
  }

  async cancelAppointment(appointmentId, reason, cancelledBy) {
    throw new Error('Method cancelAppointment() must be implemented');
  }

  async findAppointmentById(appointmentId) {
    throw new Error('Method findAppointmentById() must be implemented');
  }
}

module.exports = ServiceRequestRepository;
