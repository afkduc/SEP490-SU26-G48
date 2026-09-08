const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ApiError = require('../../utils/ApiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0[0-9]{9,10})$/;
const VALID_STATUSES = ['active', 'inactive'];
// Phai giu dong bo voi REPAIR_CATEGORY_VALUES trong RepairSettlementService.js -
// khai bao san Loai hinh sua chua cho dich vu/goi tai day de man tao phieu
// quyet toan tu dong dien theo, khong phai chon tay tung lan.
const REPAIR_CATEGORY_VALUES = ['ER', 'CB', 'EE', 'BP', 'PM', 'CS'];

let vehicleBayRepository = null;
function getVehicleBayRepository() {
  if (!vehicleBayRepository) {
    const VehicleBayRepositoryImpl = require('../../infrastructure/repositories/VehicleBayRepositoryImpl');
    vehicleBayRepository = new VehicleBayRepositoryImpl();
  }
  return vehicleBayRepository;
}

class ManagerService {
  constructor(managerRepository) {
    this.managerRepository = managerRepository;
  }

  // To truong quan ly 1 doi tho (users.team_leader_id) - dong bo lai toan bo
  // danh sach thanh vien theo memberIds truyen len (id nao khong con trong
  // danh sach thi bi go khoi doi). Chi ap dung cho user role technician,
  // cung chi nhanh voi to truong nay.
  async setTeamMembers(branchId, id, memberIds) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    const employee = await this.managerRepository.getEmployeeById(branchId, id);
    if (!employee) throw new ApiError(404, 'Không tìm thấy nhân viên');
    if (!Array.isArray(memberIds)) throw new ApiError(400, 'Danh sách thành viên không hợp lệ');

    const normalized = memberIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return this.managerRepository.setTeamMembers(branchId, Number(id), normalized);
  }

  // To truong phu trach nhieu khoang xe (bang vehicle_bays.team_leader_id) -
  // dong bo lai toan bo danh sach so khoang theo bayNumbers truyen len.
  async setBayNumbers(branchId, id, bayNumbers) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    const employee = await this.managerRepository.getEmployeeById(branchId, id);
    if (!employee) throw new ApiError(404, 'Không tìm thấy nhân viên');
    if (!Array.isArray(bayNumbers)) throw new ApiError(400, 'Danh sách khoang xe không hợp lệ');

    const normalized = bayNumbers.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (new Set(normalized).size !== normalized.length) {
      throw new ApiError(400, 'Không được nhập trùng số khoang');
    }
    // Thuc te 1 to truong luon phai co it nhat vai khoang de doi cua ho hoat
    // dong (khong the chi phu trach 1-2 khoang).
    if (normalized.length < 3) {
      throw new ApiError(400, 'Mỗi tổ trưởng phải phụ trách tối thiểu 3 khoang xe');
    }
    await getVehicleBayRepository().setBayNumbers(branchId, Number(id), normalized);
    return getVehicleBayRepository().findByTeamLeader(Number(id));
  }

  async getBranch(branchId) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    const branch = await this.managerRepository.getBranchById(branchId);
    if (!branch) throw new ApiError(404, 'Không tìm thấy chi nhánh');
    return branch;
  }

  async listRoles() {
    return this.managerRepository.listAssignableRoles();
  }

  async listEmployees(branchId, filters = {}) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const normalized = {
      search: (filters.search || '').trim(),
      status: filters.status || 'all',
      role: filters.role || 'all',
    };

    if (normalized.status !== 'all' && !VALID_STATUSES.includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    return this.managerRepository.listEmployees(branchId, normalized);
  }

  async getEmployeeById(branchId, id) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã nhân viên');

    const employee = await this.managerRepository.getEmployeeById(branchId, id);
    if (!employee) throw new ApiError(404, 'Không tìm thấy nhân viên');
    return employee;
  }

  async createEmployee(branchId, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const { fullName, email, phone, roleId, status, password, confirmPassword } = payload;

    if (!fullName || !email || !phone || !roleId || !password) {
      throw new ApiError(400, 'Họ tên, email, số điện thoại, vai trò và mật khẩu là bắt buộc');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new ApiError(400, 'Email không đúng định dạng');
    }

    if (!PHONE_REGEX.test(phone)) {
      throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số');
    }

    if (password.length < 8) {
      throw new ApiError(400, 'Mật khẩu tạm thời phải có ít nhất 8 ký tự');
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
      throw new ApiError(400, 'Xác nhận mật khẩu không khớp');
    }

    const normalizedStatus = status && VALID_STATUSES.includes(status) ? status : 'active';

    const existed = await this.managerRepository.findByEmail(email);
    if (existed) {
      throw new ApiError(409, 'Email đã tồn tại');
    }

    const roles = await this.managerRepository.listAssignableRoles();
    const selectedRole = roles.find((role) => Number(role.id) === Number(roleId));
    if (!selectedRole) {
      throw new ApiError(400, 'Vai trò không hợp lệ');
    }

    const specialtyIds = selectedRole.roleName === 'team_leader'
      ? await this._validateSpecialtyIds(payload.specialtyIds)
      : undefined;

    const passwordHash = bcrypt.hashSync(password, 10);
    const pseudoId = await this.managerRepository.nextPseudoId();

    return this.managerRepository.createEmployee({
      branchId,
      pseudoId,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      passwordHash,
      roleId: Number(roleId),
      status: normalizedStatus,
      specialtyIds: specialtyIds || [],
    });
  }

  async updateEmployee(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã nhân viên');

    const existing = await this.managerRepository.getEmployeeById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy nhân viên');

    const { fullName, email, phone, roleId, status, password, confirmPassword } = payload;

    if (!fullName || !email || !phone || !roleId) {
      throw new ApiError(400, 'Họ tên, email, số điện thoại và vai trò là bắt buộc');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new ApiError(400, 'Email không đúng định dạng');
    }

    if (!PHONE_REGEX.test(phone)) {
      throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số');
    }

    if (status && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    // Doi mat khau la tuy chon - chi validate/hash khi Quan ly co nhap mat
    // khau moi, khong bat buoc phai nhap lai moi lan chinh sua nhan vien.
    let passwordHash;
    if (password) {
      if (password.length < 8) {
        throw new ApiError(400, 'Mật khẩu mới phải có ít nhất 8 ký tự');
      }
      if (confirmPassword !== password) {
        throw new ApiError(400, 'Xác nhận mật khẩu không khớp');
      }
      passwordHash = bcrypt.hashSync(password, 10);
    }

    if (email !== existing.email) {
      const existed = await this.managerRepository.findByEmail(email);
      if (existed && Number(existed.id) !== Number(id)) {
        throw new ApiError(409, 'Email đã tồn tại');
      }
    }

    const roles = await this.managerRepository.listAssignableRoles();
    const selectedRole = roles.find((role) => Number(role.id) === Number(roleId));
    if (!selectedRole) {
      throw new ApiError(400, 'Vai trò không hợp lệ');
    }

    const specialtyIds = selectedRole.roleName === 'team_leader'
      ? await this._validateSpecialtyIds(payload.specialtyIds)
      : [];

    return this.managerRepository.updateEmployee(branchId, id, {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      roleId: Number(roleId),
      status: status || existing.status,
      specialtyIds: specialtyIds || [],
      passwordHash,
    });
  }

  async listServiceCategories() {
    return this.managerRepository.listServiceCategories();
  }

  async listServices(branchId, filters = {}) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const normalized = {
      search: (filters.search || '').trim(),
      status: filters.status || 'all',
      repairCategory: filters.repairCategory || 'all',
    };

    if (normalized.status !== 'all' && !VALID_STATUSES.includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }
    if (normalized.repairCategory !== 'all' && !REPAIR_CATEGORY_VALUES.includes(normalized.repairCategory)) {
      throw new ApiError(400, 'Loại hình sửa chữa không hợp lệ');
    }

    return this.managerRepository.listServices(branchId, normalized);
  }

  async getServiceById(branchId, id) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã dịch vụ');

    const service = await this.managerRepository.getServiceById(branchId, id);
    if (!service) throw new ApiError(404, 'Không tìm thấy dịch vụ');
    return service;
  }

  async _validateServiceParts(branchId, parts) {
    if (parts === undefined) return undefined;
    if (!Array.isArray(parts)) throw new ApiError(400, 'Danh sách phụ tùng không hợp lệ');
    if (parts.length === 0) return [];

    const seen = new Set();
    for (const part of parts) {
      const productId = Number(part.productId);
      const quantity = Number(part.quantity);
      if (!productId || Number.isNaN(quantity) || quantity <= 0) {
        throw new ApiError(400, 'Phụ tùng và số lượng không hợp lệ');
      }
      if (seen.has(productId)) {
        throw new ApiError(400, 'Không được chọn trùng 1 phụ tùng nhiều lần');
      }
      seen.add(productId);
    }

    const branchProducts = await this.managerRepository.listProducts(branchId);
    const validIds = new Set(branchProducts.map((p) => Number(p.id)));
    if (!parts.every((part) => validIds.has(Number(part.productId)))) {
      throw new ApiError(400, 'Có phụ tùng không thuộc chi nhánh này');
    }

    return parts.map((part) => ({ productId: Number(part.productId), quantity: Number(part.quantity) }));
  }

  async listProducts(branchId) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    return this.managerRepository.listProducts(branchId);
  }

  async _validateServicePayload(payload) {
    const { serviceName, unitPrice, durationMin } = payload;

    if (!serviceName || unitPrice === undefined || unitPrice === null || unitPrice === '') {
      throw new ApiError(400, 'Tên dịch vụ và đơn giá là bắt buộc');
    }

    const price = Number(unitPrice);
    if (Number.isNaN(price) || price < 0) {
      throw new ApiError(400, 'Đơn giá không hợp lệ');
    }

    let duration = null;
    if (durationMin !== undefined && durationMin !== null && durationMin !== '') {
      duration = Number(durationMin);
      if (Number.isNaN(duration) || duration < 0) {
        throw new ApiError(400, 'Thời gian thực hiện không hợp lệ');
      }
    }

    if (payload.repairCategory && !REPAIR_CATEGORY_VALUES.includes(payload.repairCategory)) {
      throw new ApiError(400, 'Loại hình sửa chữa không hợp lệ');
    }

    return { price, duration };
  }

  async createService(branchId, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const { price, duration } = await this._validateServicePayload(payload);
    const parts = await this._validateServiceParts(branchId, payload.parts);
    const serviceCode = await this.managerRepository.nextServiceCode(branchId);

    return this.managerRepository.createService({
      branchId,
      serviceCode,
      serviceName: payload.serviceName.trim(),
      categoryId: payload.categoryId ? Number(payload.categoryId) : null,
      unitPrice: price,
      durationMin: duration,
      description: (payload.description || '').trim() || null,
      repairCategory: payload.repairCategory || null,
      parts: parts || [],
    });
  }

  async updateService(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã dịch vụ');

    const existing = await this.managerRepository.getServiceById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy dịch vụ');

    const { price, duration } = await this._validateServicePayload(payload);
    const parts = await this._validateServiceParts(branchId, payload.parts);
    const newIsActive = payload.isActive !== undefined ? !!payload.isActive : existing.isActive;

    const updated = await this.managerRepository.updateService(branchId, id, {
      serviceName: payload.serviceName.trim(),
      categoryId: payload.categoryId ? Number(payload.categoryId) : null,
      unitPrice: price,
      durationMin: duration,
      description: (payload.description || '').trim() || null,
      isActive: newIsActive,
      repairCategory: payload.repairCategory || null,
      parts,
    });

    if (existing.isActive && !newIsActive) {
      const usedInPackages = await this.managerRepository.listPackagesUsingService(branchId, id);
      return { ...updated, usedInPackages };
    }

    return updated;
  }

  async listServicePackages(branchId, filters = {}) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const normalized = {
      search: (filters.search || '').trim(),
      status: filters.status || 'all',
      repairCategory: filters.repairCategory || 'all',
    };

    if (normalized.status !== 'all' && !VALID_STATUSES.includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }
    if (normalized.repairCategory !== 'all' && !REPAIR_CATEGORY_VALUES.includes(normalized.repairCategory)) {
      throw new ApiError(400, 'Loại hình sửa chữa không hợp lệ');
    }

    return this.managerRepository.listServicePackages(branchId, normalized);
  }

  async getServicePackageById(branchId, id) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã gói bảo dưỡng');

    const pkg = await this.managerRepository.getServicePackageById(branchId, id);
    if (!pkg) throw new ApiError(404, 'Không tìm thấy gói bảo dưỡng');
    return pkg;
  }

  async _validateServicePackagePayload(branchId, payload, { requireServiceIds }) {
    const { packageName, totalPrice, services } = payload;

    if (!packageName || totalPrice === undefined || totalPrice === null || totalPrice === '') {
      throw new ApiError(400, 'Tên gói và giá gói là bắt buộc');
    }

    const price = Number(totalPrice);
    if (Number.isNaN(price) || price < 0) {
      throw new ApiError(400, 'Giá gói không hợp lệ');
    }

    if (payload.repairCategory && !REPAIR_CATEGORY_VALUES.includes(payload.repairCategory)) {
      throw new ApiError(400, 'Loại hình sửa chữa không hợp lệ');
    }

    if (payload.modelId != null && payload.modelId !== '') {
      const validModel = await this.managerRepository.isValidVehicleModel(payload.modelId);
      if (!validModel) throw new ApiError(400, 'Dòng xe áp dụng không hợp lệ');
    }

    let normalizedServices;
    if (requireServiceIds || services !== undefined) {
      if (!Array.isArray(services) || services.length === 0) {
        throw new ApiError(400, 'Vui lòng chọn ít nhất 1 dịch vụ cho gói');
      }
      const branchServices = await this.managerRepository.listServices(branchId, {});
      const validIds = new Set(branchServices.map((s) => Number(s.id)));
      const validActionCodes = new Set(['R', 'I', 'M', 'V']);
      if (!services.every((s) => validIds.has(Number(s.serviceId)) && validActionCodes.has(s.actionCode))) {
        throw new ApiError(400, 'Có dịch vụ không thuộc chi nhánh này hoặc hành động không hợp lệ');
      }
      normalizedServices = services.map((s) => ({ serviceId: Number(s.serviceId), actionCode: s.actionCode }));
    }

    return { price, services: normalizedServices };
  }

  async createServicePackage(branchId, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const { price, services } = await this._validateServicePackagePayload(branchId, payload, {
      requireServiceIds: true,
    });
    const packageCode = await this.managerRepository.nextPackageCode(branchId);

    return this.managerRepository.createServicePackage({
      branchId,
      packageCode,
      packageName: payload.packageName.trim(),
      categoryId: payload.categoryId ? Number(payload.categoryId) : null,
      totalPrice: price,
      description: (payload.description || '').trim() || null,
      purpose: (payload.purpose || '').trim() || null,
      repairCategory: payload.repairCategory || null,
      modelId: payload.modelId || null,
      services,
    });
  }

  async updateServicePackage(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã gói bảo dưỡng');

    const existing = await this.managerRepository.getServicePackageById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy gói bảo dưỡng');

    const { price, services } = await this._validateServicePackagePayload(branchId, payload, {
      requireServiceIds: false,
    });

    return this.managerRepository.updateServicePackage(branchId, id, {
      packageName: payload.packageName.trim(),
      categoryId: payload.categoryId ? Number(payload.categoryId) : null,
      totalPrice: price,
      description: (payload.description || '').trim() || null,
      purpose: (payload.purpose || '').trim() || null,
      isActive: payload.isActive !== undefined ? !!payload.isActive : existing.isActive,
      repairCategory: payload.repairCategory || null,
      modelId: payload.modelId !== undefined ? (payload.modelId || null) : existing.modelId,
      services,
    });
  }

  async listSettlementReports(branchId, filters = {}) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const normalized = {
      search: (filters.search || '').trim(),
      status: filters.status || 'all',
    };

    return this.managerRepository.listSettlementReports(branchId, normalized);
  }

  async getSettlementReportById(branchId, id) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã phiếu quyết toán');

    const report = await this.managerRepository.getSettlementReportById(branchId, id);
    if (!report) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    return report;
  }

  async listSpecialties() {
    return this.managerRepository.listSpecialties();
  }

  async listTeamLeaderOptions(branchId) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    return this.managerRepository.listTeamLeaderOptions(branchId);
  }

  async _validateStaffContact(payload, { requirePassword }) {
    const { fullName, email, phone, password, confirmPassword } = payload;

    if (!fullName || !email || !phone || (requirePassword && !password)) {
      throw new ApiError(400, 'Họ tên, email, số điện thoại' + (requirePassword ? ' và mật khẩu' : '') + ' là bắt buộc');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new ApiError(400, 'Email không đúng định dạng');
    }

    if (!PHONE_REGEX.test(phone)) {
      throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số');
    }

    if (requirePassword) {
      if (password.length < 8) {
        throw new ApiError(400, 'Mật khẩu tạm thời phải có ít nhất 8 ký tự');
      }
      if (confirmPassword !== undefined && confirmPassword !== password) {
        throw new ApiError(400, 'Xác nhận mật khẩu không khớp');
      }
    }
  }

  async listTechnicians(branchId, filters = {}) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const normalized = {
      search: (filters.search || '').trim(),
      status: filters.status || 'all',
      teamLeaderId: filters.teamLeaderId || 'all',
    };

    if (normalized.status !== 'all' && !VALID_STATUSES.includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    return this.managerRepository.listTechnicians(branchId, normalized);
  }

  async getTechnicianById(branchId, id) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã thợ máy');

    const technician = await this.managerRepository.getTechnicianById(branchId, id);
    if (!technician) throw new ApiError(404, 'Không tìm thấy thợ máy');
    return technician;
  }

  async _validateTeamLeaderAssignment(branchId, teamLeaderId) {
    if (!teamLeaderId) {
      throw new ApiError(400, 'Vui lòng chọn tổ trưởng phụ trách thợ này');
    }
    const options = await this.managerRepository.listTeamLeaderOptions(branchId);
    if (!options.some((o) => Number(o.id) === Number(teamLeaderId))) {
      throw new ApiError(400, 'Tổ trưởng không hợp lệ hoặc không thuộc chi nhánh này');
    }
  }

  async _validateSpecialtyIds(specialtyIds) {
    if (specialtyIds === undefined || specialtyIds === null) return undefined;
    if (!Array.isArray(specialtyIds)) throw new ApiError(400, 'Danh sách chuyên môn không hợp lệ');
    if (specialtyIds.length === 0) return [];

    const all = await this.managerRepository.listSpecialties();
    const validIds = new Set(all.map((s) => Number(s.id)));
    if (!specialtyIds.every((sid) => validIds.has(Number(sid)))) {
      throw new ApiError(400, 'Có chuyên môn không hợp lệ');
    }
    return specialtyIds.map(Number);
  }

  async createTechnician(branchId, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    await this._validateStaffContact(payload, { requirePassword: false });
    await this._validateTeamLeaderAssignment(branchId, payload.teamLeaderId);
    const specialtyIds = await this._validateSpecialtyIds(payload.specialtyIds);

    const normalizedStatus = payload.status && VALID_STATUSES.includes(payload.status) ? payload.status : 'active';

    const existed = await this.managerRepository.findByEmail(payload.email);
    if (existed) throw new ApiError(409, 'Email đã tồn tại');

    // Tho may khong dang nhap qua form nay - sinh mat khau ngau nhien, ho dat
    // lai qua "Quen mat khau" khi thuc su can dang nhap.
    const passwordHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
    const pseudoId = await this.managerRepository.nextPseudoId();

    return this.managerRepository.createTechnician({
      branchId,
      pseudoId,
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      passwordHash,
      status: normalizedStatus,
      teamLeaderId: Number(payload.teamLeaderId),
      specialtyIds: specialtyIds || [],
    });
  }

  async updateTechnician(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã thợ máy');

    const existing = await this.managerRepository.getTechnicianById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy thợ máy');

    await this._validateStaffContact(payload, { requirePassword: false });
    await this._validateTeamLeaderAssignment(branchId, payload.teamLeaderId);
    const specialtyIds = await this._validateSpecialtyIds(payload.specialtyIds);

    if (payload.status && !VALID_STATUSES.includes(payload.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    if (payload.email !== existing.email) {
      const existed = await this.managerRepository.findByEmail(payload.email);
      if (existed && Number(existed.id) !== Number(id)) {
        throw new ApiError(409, 'Email đã tồn tại');
      }
    }

    return this.managerRepository.updateTechnician(branchId, id, {
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      status: payload.status || existing.status,
      teamLeaderId: Number(payload.teamLeaderId),
      specialtyIds,
    });
  }

}

module.exports = ManagerService;
