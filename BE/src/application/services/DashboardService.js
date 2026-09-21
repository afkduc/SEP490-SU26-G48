const ApiError = require('../../utils/ApiError');

const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];
// Khop REPAIR_CATEGORY_ORDER trong DashboardRepositoryImpl (PM = goi bao duong)
const REPAIR_CATEGORY_VALUES = ['ER', 'CB', 'EE', 'BP', 'CS', 'PM'];

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

  // Dich vu / goi da dung trong 1 loai hinh sua chua (bang "Hieu suat theo
  // loai hinh" bam vao tung dong). Cung bo loc voi getOverview.
  async listRepairCategoryServices({ branchId, advisorId, fromDate, toDate, status, repairCategory } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    if (!REPAIR_CATEGORY_VALUES.includes(repairCategory)) {
      throw new ApiError(400, 'Loại hình sửa chữa không hợp lệ');
    }
    if (status && !STATUS_VALUES.includes(status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }
    return this.dashboardRepository.listRepairCategoryServices({
      branchId, advisorId, fromDate, toDate, status, repairCategory,
    });
  }
}

module.exports = DashboardService;
