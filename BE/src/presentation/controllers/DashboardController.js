const { success } = require('../../utils/response');

class DashboardController {
  constructor({ dashboardService }) {
    this.dashboardService = dashboardService;
  }

  getOverview = async (req, res, next) => {
    try {
      const { fromDate, toDate, status, categoryId } = req.query;
      const result = await this.dashboardService.getOverview({
        branchId: req.user.branchId,
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
