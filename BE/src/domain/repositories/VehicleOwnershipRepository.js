class VehicleOwnershipRepository {
  async findHistoryByVehicleId(vehicleId) {
    throw new Error('Not implemented');
  }

  async transferOwnership(vehicleId, { newCustomerId, transferDate, notes } = {}) {
    throw new Error('Not implemented');
  }
}

module.exports = VehicleOwnershipRepository;
