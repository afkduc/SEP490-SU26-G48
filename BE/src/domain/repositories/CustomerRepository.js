class CustomerRepository {
  async findAllWithDetails() {
    throw new Error('Not implemented');
  }

  async findByIdWithDetails(id) {
    throw new Error('Not implemented');
  }

  async findByPhone(phone) {
    throw new Error('Method findByPhone() must be implemented');
  }

  async addVehicle(customerId, data) {
    throw new Error('Method addVehicle() must be implemented');
  }

  async update(id, data) {
    throw new Error('Not implemented');
  }

  async findOrCreateForSettlement(data) {
    throw new Error('Not implemented');
  }
}

module.exports = CustomerRepository;
