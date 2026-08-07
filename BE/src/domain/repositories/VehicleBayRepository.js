class VehicleBayRepository {
  async findByTeamLeader(teamLeaderId) {
    throw new Error('Method findByTeamLeader() must be implemented');
  }

  async findByBranch(branchId) {
    throw new Error('Method findByBranch() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  // Quan ly chi nhanh: dong bo danh sach so khoang cho 1 to truong (them/xoa).
  async setBayNumbers(branchId, teamLeaderId, bayNumbers) {
    throw new Error('Method setBayNumbers() must be implemented');
  }
}

module.exports = VehicleBayRepository;
