const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');
const BranchRepositoryImpl = require('../../infrastructure/repositories/BranchRepositoryImpl');
const {
  isValidEmail,
  isValidPhone,
  phoneDigitsOnly,
  EMAIL_HINT,
} = require('../../utils/fieldValidation');

const VALID_STATUSES = ['active', 'inactive'];
const PHONE_FORMAT_HINT =
  'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (không tính dấu gạch)';

class GeneralDirectorService {
  constructor(generalDirectorRepository) {
    this.generalDirectorRepository = generalDirectorRepository;
    this.branchRepository = new BranchRepositoryImpl();
  }

  async getRevenueReports(filters = {}) {
    const normalized = {
      branchId: filters.branchId || 'all',
      monthsBack: Number(filters.monthsBack) || 6,
    };

    if (normalized.monthsBack < 3 || normalized.monthsBack > 24) {
      throw new ApiError(400, 'monthsBack phải nằm trong khoảng 3-24');
    }

    return this.generalDirectorRepository.getRevenueReports(normalized);
  }

  async listSettlementReports(filters = {}) {
    return this.generalDirectorRepository.listSettlementReports(filters);
  }

  async getSettlementReportById(id) {
    if (!id) {
      throw new ApiError(400, 'Thiếu mã phiếu quyết toán');
    }

    const report = await this.generalDirectorRepository.getSettlementReportById(id);
    if (!report) {
      throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    }

    return report;
  }

  async listBranches() {
    return this.generalDirectorRepository.listBranches();
  }

  async listEmployees(filters = {}) {
    const normalized = {
      search: (filters.search || '').trim(),
      branchId: filters.branchId || 'all',
      status: filters.status || 'all',
      role: filters.role || 'all',
    };

    if (!['all', ...VALID_STATUSES].includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    return this.generalDirectorRepository.listEmployees(normalized);
  }

  async getEmployeeById(id) {
    if (!id) {
      throw new ApiError(400, 'Thiếu mã nhân sự');
    }

    const employee = await this.generalDirectorRepository.getEmployeeById(id);
    if (!employee) {
      throw new ApiError(404, 'Không tìm thấy nhân sự');
    }

    return employee;
  }

  async listTechnicians(filters = {}) {
    const normalized = {
      search: (filters.search || '').trim(),
      branchId: filters.branchId || 'all',
      skillGroup: filters.skillGroup || 'all',
      status: filters.status || 'all',
    };

    if (!['all', ...VALID_STATUSES].includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    const validSkillGroups = ['all', 'mechanical', 'electrical', 'painting', 'diagnostic', 'maintenance', 'other'];
    if (!validSkillGroups.includes(normalized.skillGroup)) {
      throw new ApiError(400, 'Nhóm kỹ năng không hợp lệ');
    }

    return this.generalDirectorRepository.listTechnicians(normalized);
  }

  async getTechnicianById(id) {
    if (!id) {
      throw new ApiError(400, 'Thiếu mã kỹ thuật viên');
    }

    const technician = await this.generalDirectorRepository.getTechnicianById(id);
    if (!technician) {
      throw new ApiError(404, 'Không tìm thấy kỹ thuật viên');
    }

    return technician;
  }

  async listBranchManagers(filters = {}) {
    const normalized = {
      search: (filters.search || '').trim(),
      branchId: filters.branchId || 'all',
      status: filters.status || 'all',
    };

    if (!['all', ...VALID_STATUSES].includes(normalized.status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    return this.generalDirectorRepository.listBranchManagers(normalized);
  }

  async getBranchManagerById(id) {
    if (!id) {
      throw new ApiError(400, 'Thiếu mã giám đốc chi nhánh');
    }

    const manager = await this.generalDirectorRepository.getBranchManagerById(id);
    if (!manager) {
      throw new ApiError(404, 'Không tìm thấy giám đốc chi nhánh');
    }

    return manager;
  }

  async createBranchManager(payload = {}) {
    const { fullName, email, phone, password, confirmPassword, branchId, status } = payload;

    if (!fullName || !email || !phone || !password || !branchId) {
      throw new ApiError(400, 'Họ tên, email, số điện thoại, mật khẩu và chi nhánh là bắt buộc');
    }

    if (!isValidEmail(email)) {
      throw new ApiError(400, EMAIL_HINT);
    }

    if (!isValidPhone(phone)) {
      throw new ApiError(400, PHONE_FORMAT_HINT);
    }

    if (password.length < 8) {
      throw new ApiError(400, 'Mật khẩu phải có ít nhất 8 ký tự');
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
      throw new ApiError(400, 'Xác nhận mật khẩu không khớp');
    }

    const normalizedStatus = VALID_STATUSES.includes(status) ? status : 'active';
    const passwordHash = bcrypt.hashSync(password, 10);

    return this.generalDirectorRepository.createBranchManager({
      fullName: fullName.trim(),
      email: String(email).trim(),
      phone: phoneDigitsOnly(phone),
      passwordHash,
      branchId: Number(branchId),
      status: normalizedStatus,
    });
  }

  async updateBranchManager(id, payload = {}) {
    if (!id) {
      throw new ApiError(400, 'Thiếu mã giám đốc chi nhánh');
    }

    const { fullName, email, phone, branchId, status } = payload;

    if (!fullName || !email || !phone || !branchId) {
      throw new ApiError(400, 'Họ tên, email, số điện thoại và chi nhánh là bắt buộc');
    }

    if (!isValidEmail(email)) {
      throw new ApiError(400, EMAIL_HINT);
    }

    if (!isValidPhone(phone)) {
      throw new ApiError(400, PHONE_FORMAT_HINT);
    }

    const normalizedStatus = VALID_STATUSES.includes(status) ? status : 'active';

    const existing = await this.generalDirectorRepository.getBranchManagerById(id);
    if (!existing) {
      throw new ApiError(404, 'Không tìm thấy giám đốc chi nhánh');
    }

    return this.generalDirectorRepository.updateBranchManager(id, {
      fullName: fullName.trim(),
      email: String(email).trim(),
      phone: phoneDigitsOnly(phone),
      branchId: Number(branchId),
      status: normalizedStatus,
    });
  }

  async deactivateBranch(id) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhánh không tồn tại');
    }

    return this.branchRepository.setActive(Number(id), false);
  }

  async reactivateBranch(id) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhánh không tồn tại');
    }

    return this.branchRepository.setActive(Number(id), true);
  }
}

module.exports = GeneralDirectorService;
