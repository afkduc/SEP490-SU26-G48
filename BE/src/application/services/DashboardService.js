const ApiError = require('../../utils/ApiError');

const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];

class DashboardService {
  constructor({ dashboardRepository }) {
    this.dashboardRepository = dashboardRepository;
  }

  async getOverview({ branchId, advisorId, fromDate, toDate, status, categoryId } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    if (status && !STATUS_VALUES.includes(status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }

    const [overview, categories] = await Promise.all([
      this.dashboardRepository.getOverview({ branchId, advisorId, fromDate, toDate, status, categoryId }),
      this.dashboardRepository.listCategories(),
    ]);

    return {
      ...overview,
      categories: [...categories, { id: 'PARTS', name: 'Phụ tùng' }],
    };
  }
}

module.exports = DashboardService;
