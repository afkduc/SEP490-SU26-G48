const { success } = require('../../utils/response');

class GeneralDirectorController {
  constructor(generalDirectorService) {
    this.generalDirectorService = generalDirectorService;
    this.getRevenueReports = this.getRevenueReports.bind(this);
    this.getSettlementReports = this.getSettlementReports.bind(this);
    this.getSettlementReportById = this.getSettlementReportById.bind(this);
    this.getBranches = this.getBranches.bind(this);
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
}

module.exports = GeneralDirectorController;