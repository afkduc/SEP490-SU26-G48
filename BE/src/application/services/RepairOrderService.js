const ApiError = require('../../utils/ApiError');
const RepairOrderResponseDto = require('../dto/RepairOrderDto');

class RepairOrderService {
  constructor({ repairOrderRepository }) {
    this.repairOrderRepository = repairOrderRepository;
  }

  async getAll({ branchId } = {}) {
    const items = await this.repairOrderRepository.findAll({ branchId });
    return RepairOrderResponseDto.fromEntityList(items);
  }

  async getById(id) {
    const entity = await this.repairOrderRepository.findById(id);
    if (!entity) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    return RepairOrderResponseDto.fromEntity(entity);
  }

  async getTeamLeaders(branchId) {
    return this.repairOrderRepository.findTeamLeadersByBranch(branchId);
  }

  async create(payload, { branchId, createdBy }) {
    if (!payload.serviceOrderId) {
      throw new ApiError(400, 'Phải chọn phiếu báo giá / quyết toán để tạo lệnh sửa chữa');
    }
    if (!payload.teamLeaderId) {
      throw new ApiError(400, 'Phải chọn tổ trưởng để phân công');
    }

    const serviceOrder = await this.repairOrderRepository.findEligibleServiceOrder(payload.serviceOrderId, branchId);
    if (!serviceOrder) {
      throw new ApiError(404, 'Không tìm thấy phiếu quyết toán thuộc chi nhánh của bạn');
    }
    if (serviceOrder.status !== 'waiting_repair') {
      throw new ApiError(409, 'Phiếu này đã được gán tổ trưởng hoặc không còn ở trạng thái chờ sửa chữa');
    }

    const teamLeaders = await this.repairOrderRepository.findTeamLeadersByBranch(branchId);
    const teamLeader = teamLeaders.find((t) => String(t.id) === String(payload.teamLeaderId));
    if (!teamLeader) {
      throw new ApiError(400, 'Tổ trưởng không hợp lệ hoặc không thuộc chi nhánh của bạn');
    }

    const entity = await this.repairOrderRepository.create(
      {
        serviceOrderId: payload.serviceOrderId,
        teamLeaderId: teamLeader.id,
        vehicleId: serviceOrder.vehicle_id,
        notes: payload.notes || null,
      },
      { branchId, createdBy }
    );
    return RepairOrderResponseDto.fromEntity(entity);
  }
}

module.exports = RepairOrderService;
