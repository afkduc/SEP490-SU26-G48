const { success } = require('../../utils/response');

class GeneralDirectorController {
  constructor(generalDirectorService) {
    this.generalDirectorService = generalDirectorService;
    this.getRevenueReports = this.getRevenueReports.bind(this);
    this.getSettlementReports = this.getSettlementReports.bind(this);
    this.getSettlementReportById = this.getSettlementReportById.bind(this);
    this.getBranches = this.getBranches.bind(this);
    this.getEmployees = this.getEmployees.bind(this);
    this.getEmployeeById = this.getEmployeeById.bind(this);
    this.getTechnicians = this.getTechnicians.bind(this);
    this.getTechnicianById = this.getTechnicianById.bind(this);
    this.getBranchManagers = this.getBranchManagers.bind(this);
    this.getBranchManagerById = this.getBranchManagerById.bind(this);
    this.createBranchManager = this.createBranchManager.bind(this);
    this.updateBranchManager = this.updateBranchManager.bind(this);
  }

  async getRevenueReports(req, res, next) {
    try {
      const data = await this.generalDirectorService.getRevenueReports({
        branchId: req.query.branchId || 'all',
        monthsBack: req.query.monthsBack,
      });
      return success(res, data, 'Lấy báo cáo doanh thu thành công');
    } catch (err) {
      next(err);
    }
  }

  async getSettlementReports(req, res, next) {
    try {
      const data = await this.generalDirectorService.listSettlementReports({
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
        branchId: req.query.branchId || 'all',
      });
      return success(res, data, 'Lấy danh sách phiếu quyết toán thành công');
    } catch (err) {
      next(err);
    }
  }

  async getSettlementReportById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getSettlementReportById(req.params.id);
      return success(res, data, 'Lấy chi tiết phiếu quyết toán thành công');
    } catch (err) {
      next(err);
    }
  }

  async getBranches(req, res, next) {
    try {
      const data = await this.generalDirectorService.listBranches();
      return success(res, data, 'Lấy danh sách chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async getEmployees(req, res, next) {
    try {
      const data = await this.generalDirectorService.listEmployees({
        search: req.query.search || req.query.q || '',
        branchId: req.query.branchId || 'all',
        status: req.query.status || 'all',
        role: req.query.role || 'all',
      });
      return success(res, data, 'Lấy danh sách nhân sự thành công');
    } catch (err) {
      next(err);
    }
  }

  async getEmployeeById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getEmployeeById(req.params.id);
      return success(res, data, 'Lấy chi tiết nhân sự thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTechnicians(req, res, next) {
    try {
      const data = await this.generalDirectorService.listTechnicians({
        search: req.query.search || req.query.q || '',
        branchId: req.query.branchId || 'all',
        skillGroup: req.query.skillGroup || 'all',
        status: req.query.status || 'all',
      });
      return success(res, data, 'Lấy danh sách kỹ thuật viên thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTechnicianById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getTechnicianById(req.params.id);
      return success(res, data, 'Lấy chi tiết kỹ thuật viên thành công');
    } catch (err) {
      next(err);
    }
  }

  async getBranchManagers(req, res, next) {
    try {
      const data = await this.generalDirectorService.listBranchManagers({
        search: req.query.search || req.query.q || '',
        branchId: req.query.branchId || 'all',
        status: req.query.status || 'all',
      });
      return success(res, data, 'Lấy danh sách giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async getBranchManagerById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getBranchManagerById(req.params.id);
      return success(res, data, 'Lấy chi tiết giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async createBranchManager(req, res, next) {
    try {
      const data = await this.generalDirectorService.createBranchManager(req.body || {});
      return success(res, data, 'Thêm giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async updateBranchManager(req, res, next) {
    try {
      const data = await this.generalDirectorService.updateBranchManager(req.params.id, req.body || {});
      return success(res, data, 'Cập nhật giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = GeneralDirectorController;