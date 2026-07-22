const ApiError = require('../../utils/ApiError');
const ServiceRequestResponseDto = require('../dto/ServiceRequestDto');
const { emitServiceRequestEvent } = require('../events/ServiceRequestEvents');
const BranchRepositoryImpl = require('../../infrastructure/repositories/BranchRepositoryImpl');
const { query } = require('../../infrastructure/database/sqlServer');

class ServiceRequestService {
  constructor({ serviceRequestRepository }) {
    this.serviceRequestRepository = serviceRequestRepository;
    this.branchRepository = new BranchRepositoryImpl();
  }

  // Public - danh sach chi nhanh rut gon cho 2 dropdown tren landing page,
  // khong lo thong tin quan ly chi nhanh.
  async getPublicBranches() {
    const branches = await this.branchRepository.findAll();
    return branches
      .filter((b) => b.isActive)
      .map((b) => ({ id: b.id, name: b.branchName }));
  }

  // Public - danh sach hang xe (KIA/Mazda...) cho dropdown tren landing page.
  async getPublicVehicleBrands() {
    const result = await query('SELECT id, brand_name FROM brands ORDER BY brand_name ASC');
    return result.recordset.map((row) => ({ id: row.id, name: row.brand_name }));
  }

  // Public - khach gui form "Lien he" tu landing page.
  async createPublic(payload) {
    const fullName = (payload.fullName || '').trim();
    const phone = (payload.phone || '').trim();
    const issue = (payload.issue || '').trim();
    const nearestBranchId = payload.nearestBranchId;

    if (!fullName) throw new ApiError(400, 'Vui lòng nhập họ và tên');
    if (!phone) throw new ApiError(400, 'Vui lòng nhập số điện thoại');
    if (!issue) throw new ApiError(400, 'Vui lòng mô tả vấn đề xe đang gặp phải');
    if (!nearestBranchId) throw new ApiError(400, 'Vui lòng chọn chi nhánh gần bạn nhất');

    const entity = await this.serviceRequestRepository.create({
      fullName,
      gender: payload.gender || null,
      phone,
      email: payload.email || null,
      address: payload.address || null,
      issueDescription: issue,
      purchaseBranchId: payload.purchaseBranchId || null,
      purchaseBranchOther: payload.purchaseBranchOther || null,
      vehicleBrandId: payload.vehicleBrandId || null,
      vehicleBrandOther: payload.vehicleBrandOther || null,
      nearestBranchId,
    });

    emitServiceRequestEvent(entity.nearestBranchId, 'new-request', {
      request: ServiceRequestResponseDto.fromEntity(entity),
    });

    return { id: entity.id };
  }

  // Authenticated - danh sach yeu cau cua dung chi nhanh CVDV dang dang nhap.
  async listByBranch(branchId, { status } = {}) {
    const items = await this.serviceRequestRepository.findByBranch(branchId, { status });
    return ServiceRequestResponseDto.fromEntityList(items);
  }

  async getUnreadCount(branchId) {
    return this.serviceRequestRepository.countPendingByBranch(branchId);
  }

  async getById(id, branchId) {
    const entity = await this.serviceRequestRepository.findById(id);
    if (!entity) throw new ApiError(404, 'Không tìm thấy yêu cầu này');
    if (String(entity.nearestBranchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền xem yêu cầu của chi nhánh khác');
    }
    return ServiceRequestResponseDto.fromEntity(entity);
  }

  async accept(id, { userId, userName, branchId }) {
    const existing = await this.serviceRequestRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy yêu cầu này');
    if (String(existing.nearestBranchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền thao tác trên yêu cầu của chi nhánh khác');
    }

    const entity = await this.serviceRequestRepository.acceptAtomic(id, userId);
    if (!entity) {
      throw new ApiError(409, 'Yêu cầu này đã được CVDV khác tiếp nhận');
    }

    emitServiceRequestEvent(entity.nearestBranchId, 'request-updated', {
      id: entity.id,
      status: entity.status,
      acceptedBy: entity.acceptedBy,
      acceptedByName: userName,
      acceptedAt: entity.acceptedAt,
    });

    return ServiceRequestResponseDto.fromEntity(entity);
  }

  async _assertOwnedByUser(id, { userId, branchId }) {
    const existing = await this.serviceRequestRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy yêu cầu này');
    if (String(existing.nearestBranchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền thao tác trên yêu cầu của chi nhánh khác');
    }
    if (existing.status !== 'accepted' || String(existing.acceptedBy) !== String(userId)) {
      throw new ApiError(403, 'Chỉ CVDV đã tiếp nhận yêu cầu này mới được thao tác');
    }
    return existing;
  }

  _assertNotPastDate(appointmentAt) {
    const date = new Date(appointmentAt);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Ngày giờ hẹn không hợp lệ');
    if (date.getTime() < Date.now()) {
      throw new ApiError(400, 'Không thể chọn ngày giờ hẹn trong quá khứ');
    }
  }

  async createAppointment(id, payload, { userId, branchId }) {
    await this._assertOwnedByUser(id, { userId, branchId });
    if (!payload.appointmentAt) throw new ApiError(400, 'Vui lòng chọn ngày giờ hẹn');
    this._assertNotPastDate(payload.appointmentAt);

    await this.serviceRequestRepository.createAppointment(
      id,
      { appointmentAt: payload.appointmentAt, notes: payload.notes },
      userId
    );
    return this.getById(id, branchId);
  }

  async updateAppointment(id, appointmentId, payload, { userId, branchId }) {
    await this._assertOwnedByUser(id, { userId, branchId });
    if (!payload.appointmentAt) throw new ApiError(400, 'Vui lòng chọn ngày giờ hẹn');
    this._assertNotPastDate(payload.appointmentAt);

    await this.serviceRequestRepository.updateAppointment(appointmentId, {
      appointmentAt: payload.appointmentAt,
      notes: payload.notes,
    });
    return this.getById(id, branchId);
  }

  async cancelAppointment(id, appointmentId, reason, { userId, branchId }) {
    await this._assertOwnedByUser(id, { userId, branchId });
    if (!(reason || '').trim()) throw new ApiError(400, 'Phải nhập lý do hủy');

    await this.serviceRequestRepository.cancelAppointment(appointmentId, reason.trim(), userId);
    return this.getById(id, branchId);
  }
}

module.exports = ServiceRequestService;
