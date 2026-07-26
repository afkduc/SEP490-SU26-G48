const ApiError = require('../../utils/ApiError');
const RepairOrderResponseDto = require('../dto/RepairOrderDto');
const PublicRepairProgressDto = require('../dto/PublicRepairProgressDto');
const { emitRepairOrderEvent } = require('../events/RepairOrderEvents');

const UPDATABLE_STATUS_VALUES = ['completed', 'cancelled'];

class RepairOrderService {
  constructor({ repairOrderRepository }) {
    this.repairOrderRepository = repairOrderRepository;
  }

  async getAll({ branchId, teamLeaderId } = {}) {
    const items = await this.repairOrderRepository.findAll({ branchId, teamLeaderId });
    return RepairOrderResponseDto.fromEntityList(items);
  }

  async getById(id) {
    const entity = await this.repairOrderRepository.findById(id);
    if (!entity) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    return RepairOrderResponseDto.fromEntity(entity);
  }

  // Public - khong auth, dung cho landing page (khach nhap ma sua chua de
  // xem tien do). Tra ve DTO rut gon, khong lo thong tin khach hang.
  //
  // Ma khach hang thuc su cam tren tay la ma PHIEU QUYET TOAN (order_code,
  // vd "RO-2026-068") - cap ngay luc tiep nhan xe, TRUOC KHI co lenh sua
  // chua. Nen tim theo ma nay truoc tien (ho tro ca truong hop chua gan to
  // truong). Ma lenh sua chua (repair_code, "LSC-...") chi la du phong cho
  // truong hop hiem gap ai do nhap nham/duoc cho nham ma noi bo.
  async getPublicProgressByCode(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) throw new ApiError(400, 'Vui lòng nhập mã sửa chữa');

    const result = await this.repairOrderRepository.findByServiceOrderCode(trimmed)
      || (await this.repairOrderRepository.findByCode(trimmed));
    if (!result) throw new ApiError(404, 'Không tìm thấy mã sửa chữa này');

    return PublicRepairProgressDto.fromEntity(result);
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

    // Realtime: day ngay cho to truong duoc gan - man "Cong viec cua toi"
    // se thay lenh moi khong can cho vong lap 20s/F5 (xem sseRoutes.js).
    emitRepairOrderEvent(branchId, 'assigned', {
      teamLeaderId: entity.teamLeaderId,
      orderId: entity.id,
      settlementId: entity.serviceOrderId,
      code: entity.code,
    });

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
    if (existing.status !== 'inprogress') {
      throw new ApiError(409, 'Lệnh đã kết thúc (hoàn thành/hủy), không thể đổi trạng thái nữa');
    }
    // Chi dau muc "dich vu" (task_type='service') can tich - phu tung
    // (task_type='product') chi de hien thi, khong tinh vao dieu kien hoan thanh.
    if (status === 'completed' && existing.tasks.some((t) => t.taskType === 'service' && !t.isDone)) {
      throw new ApiError(409, 'Cần tích hoàn thành tất cả đầu mục công việc trước khi kết thúc lệnh');
    }

    const entity = await this.repairOrderRepository.updateStatus(id, status, cancelReason);

    // Realtime: to truong vua hoan thanh toan bo lenh -> phieu quyet toan goc
    // da tu chuyen "Cho thanh toan" (xem RepairOrderRepositoryImpl.updateStatus) -
    // bao ngay cho man Phieu quyet toan cua CVDV, khong can cho poll/F5.
    if (status === 'completed') {
      emitRepairOrderEvent(branchId, 'order-completed', {
        orderId: entity.id,
        settlementId: entity.serviceOrderId,
        code: entity.code,
      });
    }

    return RepairOrderResponseDto.fromEntity(entity);
  }

  async updateTaskStatus(id, taskId, isDone, { userId, branchId } = {}) {
    const existing = await this.repairOrderRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    if (String(existing.branchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền thao tác trên lệnh sửa chữa của chi nhánh khác');
    }
    if (String(existing.teamLeaderId) !== String(userId)) {
      throw new ApiError(403, 'Chỉ tổ trưởng được phân công lệnh này mới có quyền cập nhật đầu mục');
    }
    if (existing.status !== 'inprogress') {
      throw new ApiError(409, 'Lệnh đã kết thúc, không thể cập nhật đầu mục công việc');
    }
    const task = existing.tasks.find((t) => String(t.id) === String(taskId));
    if (!task) throw new ApiError(404, 'Không tìm thấy đầu mục công việc');
    if (task.taskType !== 'service') {
      throw new ApiError(400, 'Chỉ đầu mục dịch vụ mới cần tích hoàn thành');
    }
    // Tich xong la chot luon, khong cho tich lai/bo tich - tranh to truong
    // (hoac goi thang API) sua di sua lai trang thai da xac nhan hoan thanh.
    if (task.isDone) {
      throw new ApiError(409, 'Đầu mục này đã được xác nhận hoàn thành, không thể thay đổi lại');
    }
    if (!isDone) {
      throw new ApiError(400, 'Không thể bỏ tích đầu mục công việc');
    }

    await this.repairOrderRepository.updateTaskStatus(taskId, isDone);

    // Realtime: bao CVDV dang mo modal "Xem chi tiet" phieu quyet toan nay
    // biet ngay tien do vua thay doi, khong can F5 (xem sseRoutes.js).
    emitRepairOrderEvent(branchId, 'task-updated', {
      orderId: Number(id),
      settlementId: existing.serviceOrderId,
      taskId: Number(taskId),
    });

    return this.getById(id);
  }
}

module.exports = RepairOrderService;
