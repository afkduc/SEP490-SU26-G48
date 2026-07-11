const ApiError = require('../../utils/ApiError');

class GeneralDirectorService {
  constructor(generalDirectorRepository) {
    this.generalDirectorRepository = generalDirectorRepository;
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

    const validStatuses = ['all', 'active', 'inactive'];
    if (!validStatuses.includes(normalized.status)) {
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

    const validStatuses = ['all', 'active', 'inactive'];
    if (!validStatuses.includes(normalized.status)) {
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
}

module.exports = GeneralDirectorService;