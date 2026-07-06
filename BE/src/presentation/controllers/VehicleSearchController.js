const { success } = require('../../utils/response');

class VehicleSearchController {
  constructor(vehicleSearchService) {
    this.vehicleSearchService = vehicleSearchService;
    this.search = this.search.bind(this);
  }

  async search(req, res, next) {
    try {
      const results = await this.vehicleSearchService.search(req.query.q);
      return success(res, results, 'Tìm kiếm thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = VehicleSearchController;
