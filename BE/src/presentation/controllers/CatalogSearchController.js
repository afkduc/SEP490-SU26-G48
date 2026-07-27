const { success } = require('../../utils/response');

class CatalogSearchController {
  constructor(catalogSearchService) {
    this.catalogSearchService = catalogSearchService;
    this.search = this.search.bind(this);
  }

  async search(req, res, next) {
    try {
      const results = await this.catalogSearchService.search(req.query.q, req.user.branchId);
      return success(res, results, 'Tìm kiếm thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CatalogSearchController;
