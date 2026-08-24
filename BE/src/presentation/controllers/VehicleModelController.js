const { success } = require('../../utils/response');

class VehicleModelController {
  constructor({ vehicleModelRepository }) {
    this.vehicleModelRepository = vehicleModelRepository;
  }

  list = async (req, res, next) => {
    try {
      const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
      const items = await this.vehicleModelRepository.list({ brandId });
      return success(res, items, 'Vehicle models retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleModelController;
