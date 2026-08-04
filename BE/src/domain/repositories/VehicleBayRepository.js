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

  // Tra ve VehicleBay neu chiem thanh cong, null neu khoang thuoc to truong
  // khac hoac dang bi 1 device khac giu (chua nha).
  async occupy(id, { teamLeaderId, userId, deviceId }) {
    throw new Error('Method occupy() must be implemented');
  }

  async release(id, { deviceId }) {
    throw new Error('Method release() must be implemented');
  }

  async heartbeat(id, deviceId) {
    throw new Error('Method heartbeat() must be implemented');
  }

  async releaseStale(thresholdSeconds) {
    throw new Error('Method releaseStale() must be implemented');
  }

  // Quan ly chi nhanh: dong bo danh sach so khoang cho 1 to truong (them/xoa).
  async setBayNumbers(branchId, teamLeaderId, bayNumbers) {
    throw new Error('Method setBayNumbers() must be implemented');
  }
}

module.exports = VehicleBayRepository;
