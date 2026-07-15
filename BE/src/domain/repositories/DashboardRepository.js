class DashboardRepository {
  async getOverview({ branchId, fromDate, toDate, status, categoryId } = {}) {
    throw new Error('Not implemented');
  }

  async listCategories() {
    throw new Error('Not implemented');
  }
}

module.exports = DashboardRepository;
