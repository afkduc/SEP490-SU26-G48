const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0[0-9]{9,10})$/;
const VALID_STATUSES = ['active', 'inactive'];

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

    const categories = await this.managerRepository.listServiceCategories();
    if (!categories.some((c) => Number(c.id) === Number(categoryId))) {
      throw new ApiError(400, 'Danh mục không hợp lệ');
    }

    return { price, duration };
  }

  async createService(branchId, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const { price, duration } = await this._validateServicePayload(payload);
    const serviceCode = await this.managerRepository.nextServiceCode(branchId);

    return this.managerRepository.createService({
      branchId,
      serviceCode,
      serviceName: payload.serviceName.trim(),
      categoryId: Number(payload.categoryId),
      unitPrice: price,
      durationMin: duration,
      description: (payload.description || '').trim() || null,
    });
  }

  async updateService(branchId, id, payload) {
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');
    if (!id) throw new ApiError(400, 'Thiếu mã dịch vụ');

    const existing = await this.managerRepository.getServiceById(branchId, id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy dịch vụ');

    const { price, duration } = await this._validateServicePayload(payload);

    return this.managerRepository.updateService(branchId, id, {
      serviceName: payload.serviceName.trim(),
      categoryId: Number(payload.categoryId),
      unitPrice: price,
      durationMin: duration,
      description: (payload.description || '').trim() || null,
      isActive: payload.isActive !== undefined ? !!payload.isActive : existing.isActive,
    });
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
      const validIds = new Set(branchServices.map((s) => s.id));
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
      serviceIds,
    });
  }
}

module.exports = ManagerService;
