const { success } = require('../../utils/response');

class CatalogSearchController {
  constructor(catalogSearchService) {
    this.catalogSearchService = catalogSearchService;
    this.search = this.search.bind(this);
  }

  async search(req, res, next) {
    try {
      // modelId: doi xe cua chiec dang lap phieu - de khong goi y dich vu/goi
      // cua doi xe khac. Thieu thi tra ve het (xe cu chua gan duoc doi xe).
      const results = await this.catalogSearchService.search(
        req.query.q, req.user.branchId, req.query.modelId || null
      );
      return success(res, results, 'Tìm kiếm thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CatalogSearchController;
