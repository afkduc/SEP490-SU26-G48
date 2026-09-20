const ApiError = require('../../utils/ApiError');
const MaintenanceReminderResponseDto = require('../dto/MaintenanceReminderDto');

const STATUS_VALUES = ['pending', 'sent', 'confirmed'];

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

class MaintenanceReminderService {
  constructor({ maintenanceReminderRepository }) {
    this.maintenanceReminderRepository = maintenanceReminderRepository;
  }

  async getAll({ branchId, status, search } = {}) {
    if (status && !STATUS_VALUES.includes(status)) {
      throw new ApiError(400, 'Trạng thái lọc không hợp lệ');
    }
    await this.maintenanceReminderRepository.syncFromServiceOrders();
    const items = await this.maintenanceReminderRepository.findAll({ branchId, status, search });
    return MaintenanceReminderResponseDto.fromEntityList(items);
  }

  async markSent(id, { branchId, notes } = {}) {
    const existing = await this._getOwned(id, branchId);
    if (existing.isConfirmed) {
      throw new ApiError(409, 'Nhắc nhở này đã được khách xác nhận');
    }
    const entity = await this.maintenanceReminderRepository.markSent(id, { notes });
    return MaintenanceReminderResponseDto.fromEntity(entity);
  }

  async markConfirmed(id, { branchId, confirmedDate, notes } = {}) {
    await this._getOwned(id, branchId);
    // Ngay khach hen phai tu hom nay tro di - ghi ngay qua khu thi nhac nho
    // vua xac nhan xong da thanh qua han, danh sach cham soc bao sai.
    if (confirmedDate) {
      const d = new Date(confirmedDate);
      if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Ngày hẹn không hợp lệ');
      if (d.toISOString().slice(0, 10) < todayISODate()) {
        throw new ApiError(400, 'Ngày hẹn không được ở quá khứ');
      }
    }
    const entity = await this.maintenanceReminderRepository.markConfirmed(id, {
      confirmedDate: confirmedDate || todayISODate(),
      notes,
    });
    return MaintenanceReminderResponseDto.fromEntity(entity);
  }

  async _getOwned(id, branchId) {
    const existing = await this.maintenanceReminderRepository.findById(id);
    if (!existing || String(existing.branchId) !== String(branchId)) {
      throw new ApiError(404, 'Không tìm thấy nhắc nhở bảo dưỡng');
    }
    return existing;
  }
}

module.exports = MaintenanceReminderService;
