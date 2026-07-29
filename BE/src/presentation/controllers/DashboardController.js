const { success } = require('../../utils/response');

class DashboardController {
  constructor({ dashboardService }) {
    this.dashboardService = dashboardService;
  }

  getOverview = async (req, res, next) => {
    try {
      const { fromDate, toDate, status, categoryId } = req.query;
      // Co van dich vu chi xem duoc thong ke cua chinh minh (cac phieu minh
      // lam advisor); Quan ly va cac vai tro khac van xem toan chi nhanh.
      const isServiceAdvisor = req.user.roles?.includes('service_advisor');
      const result = await this.dashboardService.getOverview({
        branchId: req.user.branchId,
        advisorId: isServiceAdvisor ? req.user.userId : undefined,
        fromDate,
        toDate,
        status,
        categoryId,
      });
      return success(res, result, 'Dashboard overview retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = DashboardController;
