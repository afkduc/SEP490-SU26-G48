const { success } = require('../../utils/response');

class VehicleModelController {
  constructor({ vehicleModelRepository }) {
    this.vehicleModelRepository = vehicleModelRepository;
  }

  list = async (req, res, next) => {
    try {
      const items = await this.vehicleModelRepository.list();
      return success(res, items, 'Vehicle models retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleModelController;
