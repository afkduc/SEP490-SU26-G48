const ApiError = require('../../utils/ApiError');
const RepairSettlementResponseDto = require('../dto/RepairSettlementDto');

// LHSC chi con phan anh noi dung dong (cong/vat tu); "ai tra tien" da chuyen
// het sang HTTT (tranh 2 truong cung dung ma 'BH' nhung nghia khac nhau).
const LHSC_VALUES = ['DV', 'PT'];
const HTTT_VALUES = ['KHT', 'BHH', 'BH', 'NB'];
const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];

// FE gui "Ngay ke tiep" dang dd/mm/yyyy (o nhap tu do, khong phai <input type="date">).
function parseDDMMYYYY(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

class RepairSettlementService {
  constructor({ repairSettlementRepository }) {
    this.repairSettlementRepository = repairSettlementRepository;
  }

  async getAll({ branchId, status, search, page, limit } = {}) {
    const [items, total] = await Promise.all([
      this.repairSettlementRepository.findAll({ branchId, status, search, page, limit }),
      this.repairSettlementRepository.count({ branchId, status, search }),
    ]);
    return {
      items: RepairSettlementResponseDto.fromEntityList(items),
      total,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    };
  }

  async getById(id) {
    const entity = await this.repairSettlementRepository.findById(id);
    if (!entity) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    return RepairSettlementResponseDto.fromEntity(entity);
  }

  async create(payload, { branchId, advisorId }) {
    const data = this._validateAndNormalize(payload);
    const entity = await this.repairSettlementRepository.create(data, { branchId, advisorId });
    return RepairSettlementResponseDto.fromEntity(entity);
  }

  async update(id, payload) {
    const existing = await this.repairSettlementRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    if (existing.status === 'invoiced') {
      throw new ApiError(409, 'Phiếu đã xuất hóa đơn, không thể chỉnh sửa');
    }

    const data = this._validateAndNormalize(payload);
    const entity = await this.repairSettlementRepository.update(id, data);
    return RepairSettlementResponseDto.fromEntity(entity);
  }

  async updateStatus(id, status, { issuedBy, cancelReason } = {}) {
    if (!STATUS_VALUES.includes(status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }
    const existing = await this.repairSettlementRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    if (existing.status === 'invoiced') {
      throw new ApiError(409, 'Phiếu đã xuất hóa đơn, không thể đổi trạng thái');
    }
    if (status === 'cancelled') {
      if (existing.status !== 'waiting_repair') {
        throw new ApiError(409, 'Chỉ có thể hủy phiếu khi đang ở trạng thái chờ sửa chữa (chưa phân công tổ trưởng)');
      }
      if (!(cancelReason || '').trim()) {
        throw new ApiError(400, 'Phải nhập lý do hủy');
      }
    }

    const entity = await this.repairSettlementRepository.updateStatus(id, status, { issuedBy, cancelReason });
    return RepairSettlementResponseDto.fromEntity(entity);
  }

  _validateAndNormalize(payload) {
    if (!payload.customerId || !payload.vehicleId) {
      throw new ApiError(400, 'Phải chọn khách hàng và xe từ gợi ý tra cứu');
    }

    const items = (payload.items || []).filter((i) => (i.description || '').trim().length > 0);
    if (items.length === 0) {
      throw new ApiError(400, 'Phải có ít nhất 1 hạng mục công việc/phụ tùng');
    }
    if (!items.some((i) => Number(i.unitPrice) > 0)) {
      throw new ApiError(400, 'Phải có ít nhất 1 hạng mục có đơn giá lớn hơn 0');
    }
    for (const item of items) {
      if (!LHSC_VALUES.includes(item.lhsc)) {
        throw new ApiError(400, `Loại hình sửa chữa không hợp lệ: ${item.lhsc}`);
      }
      if (!HTTT_VALUES.includes(item.httt)) {
        throw new ApiError(400, `Hình thức thanh toán không hợp lệ: ${item.httt}`);
      }
    }

    return {
      customerId: payload.customerId,
      vehicleId: payload.vehicleId,
      customerRequest: payload.customerRequest || null,
      currentKm: payload.currentKm ? Number(payload.currentKm) : null,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      afterDiscount: payload.afterDiscount,
      vat: payload.vat,
      freeAmount: payload.freeAmount,
      total: payload.total,
      nextMaintenanceKm: payload.nextMaintenanceKm ? Number(payload.nextMaintenanceKm) : null,
      nextMaintenanceDate: parseDDMMYYYY(payload.nextMaintenanceDate),
      items,
    };
  }
}

module.exports = RepairSettlementService;
