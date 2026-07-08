const ApiError = require('../../utils/ApiError');

class GeneralDirectorService {
  constructor(generalDirectorRepository) {
    this.generalDirectorRepository = generalDirectorRepository;
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
}

module.exports = GeneralDirectorService;