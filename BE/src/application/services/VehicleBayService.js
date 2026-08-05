class VehicleBayService {
  constructor({ vehicleBayRepository }) {
    this.vehicleBayRepository = vehicleBayRepository;
  }

  // To truong (dang nhap binh thuong, khong dung chung tai khoan nua) chon
  // khoang de gan viec vua nhan - chi cac khoang thuoc chinh minh phu trach.
  async listMine(teamLeaderId) {
    return this.vehicleBayRepository.findByTeamLeader(teamLeaderId);
  }

  // Man CVDV "Khoang xe dang hoat dong" - toan bo khoang trong chi nhanh.
  async listByBranch(branchId) {
    return this.vehicleBayRepository.findByBranch(branchId);
  }
}

module.exports = VehicleBayService;
