const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0[0-9]{9,10})$/;
const VALID_STATUSES = ['active', 'inactive'];
// Phai giu dong bo voi REPAIR_CATEGORY_VALUES trong RepairSettlementService.js -
// khai bao san Loai hinh sua chua cho dich vu/goi tai day de man tao phieu
// quyet toan tu dong dien theo, khong phai chon tay tung lan.
const REPAIR_CATEGORY_VALUES = ['ER', 'CB', 'EE', 'BP', 'PM'];

class ManagerService {
  constructor(managerRepository) {
    this.managerRepository = managerRepository;
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
    if (!roles.some((role) => Number(role.id) === Number(roleId))) {
      throw new ApiError(400, 'Vai trò không hợp lệ');
    }

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
    });
  }

  async updateEmployee(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã nhân viên');

    const existing = await this.managerRepository.getEmployeeById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy nhân viên');

    const { fullName, email, phone, roleId, status } = payload;

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

    if (email !== existing.email) {
      const existed = await this.managerRepository.findByEmail(email);
      if (existed && Number(existed.id) !== Number(id)) {
        throw new ApiError(409, 'Email đã tồn tại');
      }
    }

    const roles = await this.managerRepository.listAssignableRoles();
    if (!roles.some((role) => Number(role.id) === Number(roleId))) {
      throw new ApiError(400, 'Vai trò không hợp lệ');
    }

    return this.managerRepository.updateEmployee(branchId, id, {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      roleId: Number(roleId),
      status: status || existing.status,
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
      categoryId: filters.categoryId || 'all',
    };

    if (normalized.status !== 'all' && !VALID_STATUSES.includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
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
    const { serviceName, categoryId, unitPrice, durationMin } = payload;

    if (!serviceName || !categoryId || unitPrice === undefined || unitPrice === null || unitPrice === '') {
      throw new ApiError(400, 'Tên dịch vụ, danh mục và đơn giá là bắt buộc');
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

    const categories = await this.managerRepository.listServiceCategories();
    if (!categories.some((c) => Number(c.id) === Number(categoryId))) {
      throw new ApiError(400, 'Danh mục không hợp lệ');
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
      categoryId: Number(payload.categoryId),
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
      categoryId: Number(payload.categoryId),
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
    };

    if (normalized.status !== 'all' && !VALID_STATUSES.includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    return this.managerRepository.listServicePackages(branchId, normalized);
  }

  async getServicePackageById(branchId, id) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã gói dịch vụ');

    const pkg = await this.managerRepository.getServicePackageById(branchId, id);
    if (!pkg) throw new ApiError(404, 'Không tìm thấy gói dịch vụ');
    return pkg;
  }

  async _validateServicePackagePayload(branchId, payload, { requireServiceIds }) {
    const { packageName, categoryId, applicableKm, totalPrice, serviceIds } = payload;

    if (!packageName || !categoryId || totalPrice === undefined || totalPrice === null || totalPrice === '') {
      throw new ApiError(400, 'Tên gói, danh mục và giá gói là bắt buộc');
    }

    const price = Number(totalPrice);
    if (Number.isNaN(price) || price < 0) {
      throw new ApiError(400, 'Giá gói không hợp lệ');
    }

    let km = null;
    if (applicableKm !== undefined && applicableKm !== null && applicableKm !== '') {
      km = Number(applicableKm);
      if (Number.isNaN(km) || km < 0) {
        throw new ApiError(400, 'Mốc km áp dụng không hợp lệ');
      }
    }

    if (payload.repairCategory && !REPAIR_CATEGORY_VALUES.includes(payload.repairCategory)) {
      throw new ApiError(400, 'Loại hình sửa chữa không hợp lệ');
    }

    const categories = await this.managerRepository.listServiceCategories();
    if (!categories.some((c) => Number(c.id) === Number(categoryId))) {
      throw new ApiError(400, 'Danh mục không hợp lệ');
    }

    let normalizedServiceIds;
    if (requireServiceIds || serviceIds !== undefined) {
      if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        throw new ApiError(400, 'Vui lòng chọn ít nhất 1 dịch vụ cho gói');
      }
      const branchServices = await this.managerRepository.listServices(branchId, {});
      const validIds = new Set(branchServices.map((s) => Number(s.id)));
      if (!serviceIds.every((sid) => validIds.has(Number(sid)))) {
        throw new ApiError(400, 'Có dịch vụ không thuộc chi nhánh này');
      }
      normalizedServiceIds = serviceIds.map(Number);
    }

    return { price, km, serviceIds: normalizedServiceIds };
  }

  async createServicePackage(branchId, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const { price, km, serviceIds } = await this._validateServicePackagePayload(branchId, payload, {
      requireServiceIds: true,
    });
    const packageCode = await this.managerRepository.nextPackageCode(branchId);

    return this.managerRepository.createServicePackage({
      branchId,
      packageCode,
      packageName: payload.packageName.trim(),
      categoryId: Number(payload.categoryId),
      applicableKm: km,
      totalPrice: price,
      description: (payload.description || '').trim() || null,
      repairCategory: payload.repairCategory || null,
      serviceIds,
    });
  }

  async updateServicePackage(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã gói dịch vụ');

    const existing = await this.managerRepository.getServicePackageById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy gói dịch vụ');

    const { price, km, serviceIds } = await this._validateServicePackagePayload(branchId, payload, {
      requireServiceIds: false,
    });

    return this.managerRepository.updateServicePackage(branchId, id, {
      packageName: payload.packageName.trim(),
      categoryId: Number(payload.categoryId),
      applicableKm: km,
      totalPrice: price,
      description: (payload.description || '').trim() || null,
      isActive: payload.isActive !== undefined ? !!payload.isActive : existing.isActive,
      repairCategory: payload.repairCategory || null,
      serviceIds,
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

    await this._validateStaffContact(payload, { requirePassword: true });
    await this._validateTeamLeaderAssignment(branchId, payload.teamLeaderId);
    const specialtyIds = await this._validateSpecialtyIds(payload.specialtyIds);

    const normalizedStatus = payload.status && VALID_STATUSES.includes(payload.status) ? payload.status : 'active';

    const existed = await this.managerRepository.findByEmail(payload.email);
    if (existed) throw new ApiError(409, 'Email đã tồn tại');

    const passwordHash = bcrypt.hashSync(payload.password, 10);
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

  async listTeamLeaders(branchId, filters = {}) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const normalized = {
      search: (filters.search || '').trim(),
      status: filters.status || 'all',
    };

    if (normalized.status !== 'all' && !VALID_STATUSES.includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    return this.managerRepository.listTeamLeaders(branchId, normalized);
  }

  async getTeamLeaderById(branchId, id) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã tổ trưởng');

    const teamLeader = await this.managerRepository.getTeamLeaderById(branchId, id);
    if (!teamLeader) throw new ApiError(404, 'Không tìm thấy tổ trưởng');
    return teamLeader;
  }

  async createTeamLeader(branchId, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    await this._validateStaffContact(payload, { requirePassword: true });

    const normalizedStatus = payload.status && VALID_STATUSES.includes(payload.status) ? payload.status : 'active';

    const existed = await this.managerRepository.findByEmail(payload.email);
    if (existed) throw new ApiError(409, 'Email đã tồn tại');

    const passwordHash = bcrypt.hashSync(payload.password, 10);
    const pseudoId = await this.managerRepository.nextPseudoId();

    return this.managerRepository.createTeamLeader({
      branchId,
      pseudoId,
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      passwordHash,
      status: normalizedStatus,
    });
  }

  async updateTeamLeader(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã tổ trưởng');

    const existing = await this.managerRepository.getTeamLeaderById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy tổ trưởng');

    await this._validateStaffContact(payload, { requirePassword: false });

    if (payload.status && !VALID_STATUSES.includes(payload.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    if (payload.email !== existing.email) {
      const existed = await this.managerRepository.findByEmail(payload.email);
      if (existed && Number(existed.id) !== Number(id)) {
        throw new ApiError(409, 'Email đã tồn tại');
      }
    }

    return this.managerRepository.updateTeamLeader(branchId, id, {
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      status: payload.status || existing.status,
    });
  }
}

module.exports = ManagerService;
