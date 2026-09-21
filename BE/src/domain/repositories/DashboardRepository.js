class DashboardRepository {
  async getOverview({ branchId, fromDate, toDate, status, categoryId } = {}) {
    throw new Error('Not implemented');
  }

  async listCategories() {
    throw new Error('Not implemented');
  }

  // Dich vu (hoac goi bao duong, voi PM) da dung trong 1 loai hinh sua chua
  // + so phieu / so luong / doanh thu - cung pham vi loc voi getOverview.
  async listRepairCategoryServices({ branchId, advisorId, fromDate, toDate, status, repairCategory } = {}) {
    throw new Error('Not implemented');
  }
}

module.exports = DashboardRepository;
