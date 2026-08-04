const ApiError = require('../../utils/ApiError');
const { emitRepairOrderEvent } = require('../events/RepairOrderEvents');

class VehicleBayService {
  constructor({ vehicleBayRepository }) {
    this.vehicleBayRepository = vehicleBayRepository;
  }

  // Man BaySelectScreen (to truong vua dang nhap) - chi cac khoang thuoc
  // chinh minh phu trach.
  async listMine(teamLeaderId) {
    return this.vehicleBayRepository.findByTeamLeader(teamLeaderId);
  }

  // Man CVDV "Khoang xe dang hoat dong" - toan bo khoang trong chi nhanh.
  async listByBranch(branchId) {
    return this.vehicleBayRepository.findByBranch(branchId);
  }

  async occupy(id, { teamLeaderId, userId, deviceId, branchId }) {
    if (!(deviceId || '').trim()) throw new ApiError(400, 'Thiếu mã thiết bị');
    const bay = await this.vehicleBayRepository.occupy(id, { teamLeaderId, userId, deviceId: deviceId.trim() });
    if (!bay) {
      throw new ApiError(409, 'Khoang này đang được thiết bị khác sử dụng hoặc không thuộc quyền quản lý của bạn');
    }
    emitRepairOrderEvent(branchId, 'bay-occupied', { bayId: bay.id, bayNumber: bay.bayNumber, teamLeaderId });
    return bay;
  }

  async release(id, { deviceId, branchId }) {
    if (!(deviceId || '').trim()) throw new ApiError(400, 'Thiếu mã thiết bị');
    await this.vehicleBayRepository.release(id, { deviceId: deviceId.trim() });
    emitRepairOrderEvent(branchId, 'bay-released', { bayId: Number(id) });
  }

  // Tablet dinh ky bao con song - xem bayHeartbeatCleanupJob.js cho phan tu
  // dong nha khoang khi ngung heartbeat (mat dien/rot mang...).
  async heartbeat(id, deviceId) {
    if (!(deviceId || '').trim()) throw new ApiError(400, 'Thiếu mã thiết bị');
    const ok = await this.vehicleBayRepository.heartbeat(id, deviceId.trim());
    if (!ok) {
      throw new ApiError(409, 'Khoang này không còn thuộc phiên của bạn, vui lòng chọn lại khoang');
    }
  }
}

module.exports = VehicleBayService;
