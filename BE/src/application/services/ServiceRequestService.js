const ApiError = require('../../utils/ApiError');
const ServiceRequestResponseDto = require('../dto/ServiceRequestDto');
const { emitServiceRequestEvent } = require('../events/ServiceRequestEvents');
const BranchRepositoryImpl = require('../../infrastructure/repositories/BranchRepositoryImpl');
const { query } = require('../../infrastructure/database/sqlServer');
const { isValidPhone, isValidEmail, EMAIL_HINT } = require('../../utils/fieldValidation');

// service_packages luu rieng theo tung chi nhanh (gia co the khac nhau) -
// dung chi nhanh id=1 (Ha Noi, dang co du lieu goi day du nhat) lam gia
// tham khao chung cho section + trang chi tiet "Goi dich vu" tren landing.
const PUBLIC_SERVICE_PACKAGE_BRANCH_ID = 1;

class ServiceRequestService {
  constructor({ serviceRequestRepository }) {
    this.serviceRequestRepository = serviceRequestRepository;
    this.branchRepository = new BranchRepositoryImpl();
  }

  // Public - danh sach chi nhanh cho dropdown + section "He thong chi nhanh"
  // tren landing page. Bo qua thong tin quan ly chi nhanh (manager...).
  async getPublicBranches() {
    const branches = await this.branchRepository.findAll();
    return branches
      .filter((b) => b.isActive)
      .map((b) => ({ id: b.id, code: b.branchCode, name: b.branchName, address: b.address, phone: b.phone }));
  }

  // Public - vai goi dich vu tieu bieu cho section "Goi dich vu" tren landing
  // page. service_packages luu rieng theo tung chi nhanh (gia co the khac
  // nhau) - lay tam theo chi nhanh id=1 (Ha Noi, chi nhanh dang co du lieu
  // goi day du nhat) lam gia tham khao chung.
  async getPublicServicePackages() {
    // Landing chi quang cao goi bao duong (PM), khong hien goi sua chua
    // (ER/CB/EE/BP) du co trong catalog CRM. Kem segment (Sedan/SUV/Pickup)
    // de landing filter theo loai xe, khong liet ke tung dong Mazda.
    const result = await query(
      `SELECT sp.package_code, sp.package_name, sp.total_price, sp.description,
              c.category_name, vm.segment
       FROM service_packages sp
       LEFT JOIN service_categories c ON c.id = sp.category_id
       LEFT JOIN vehicle_models vm ON vm.id = sp.model_id
       WHERE sp.branch_id = @branchId
         AND sp.is_active = 1
         AND sp.repair_category = 'PM'
       ORDER BY sp.total_price ASC`,
      { branchId: PUBLIC_SERVICE_PACKAGE_BRANCH_ID }
    );
    return result.recordset.map((row) => ({
      code: row.package_code,
      name: row.package_name,
      totalPrice: Number(row.total_price || 0),
      description: row.description,
      categoryName: row.category_name,
      segment: row.segment || null,
    }));
  }

  // Public - chi tiet 1 goi dich vu (trang /goi-dich-vu/[code] tren landing),
  // kem danh sach hang muc con de khach xem "goi nay gom nhung gi".
  async getPublicServicePackageByCode(code) {
    const result = await query(
      `SELECT sp.id, sp.package_name, sp.total_price, sp.description, sp.purpose, c.category_name
       FROM service_packages sp
       LEFT JOIN service_categories c ON c.id = sp.category_id
       WHERE sp.package_code = @code
         AND sp.branch_id = @branchId
         AND sp.is_active = 1
         AND sp.repair_category = 'PM'`,
      { code, branchId: PUBLIC_SERVICE_PACKAGE_BRANCH_ID }
    );
    const row = result.recordset[0];
    if (!row) throw new ApiError(404, 'Không tìm thấy gói bảo dưỡng');

    const itemsResult = await query(
      `SELECT s.service_name, s.unit_price
       FROM service_package_items spi
       JOIN services s ON s.id = spi.service_id
       WHERE spi.package_id = @packageId AND s.is_active = 1
       ORDER BY s.service_name ASC`,
      { packageId: row.id }
    );

    return {
      name: row.package_name,
      totalPrice: Number(row.total_price || 0),
      description: row.description,
      purpose: row.purpose,
      categoryName: row.category_name,
      items: itemsResult.recordset.map((r) => ({
        name: r.service_name,
        unitPrice: Number(r.unit_price || 0),
      })),
    };
  }

  // Public - khach gui form "Lien he" tu landing page.
  async createPublic(payload) {
    const fullName = (payload.fullName || '').trim();
    const phone = (payload.phone || '').trim();
    const issue = (payload.issue || '').trim();
    const nearestBranchId = payload.nearestBranchId;

    if (!fullName) throw new ApiError(400, 'Vui lòng nhập họ và tên');
    if (!phone) throw new ApiError(400, 'Vui lòng nhập số điện thoại');
    if (!isValidPhone(phone)) throw new ApiError(400, 'Số điện thoại không hợp lệ');
    if ((payload.email || '').trim() && !isValidEmail(payload.email)) throw new ApiError(400, EMAIL_HINT);
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
