const ApiError = require('../../utils/ApiError');
const RepairOrderResponseDto = require('../dto/RepairOrderDto');

const UPDATABLE_STATUS_VALUES = ['completed', 'cancelled'];

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

  async updateStatus(id, status, { branchId, cancelReason } = {}) {
    if (!UPDATABLE_STATUS_VALUES.includes(status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }
    if (status === 'cancelled' && !(cancelReason || '').trim()) {
      throw new ApiError(400, 'Phải nhập lý do hủy');
    }
    const existing = await this.repairOrderRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    if (String(existing.branchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền thao tác trên lệnh sửa chữa của chi nhánh khác');
    }
    if (existing.status !== 'in_progress') {
      throw new ApiError(409, 'Lệnh đã kết thúc (hoàn thành/hủy), không thể đổi trạng thái nữa');
    }

    const entity = await this.repairOrderRepository.updateStatus(id, status, cancelReason);
    return RepairOrderResponseDto.fromEntity(entity);
  }
}

module.exports = RepairOrderService;
