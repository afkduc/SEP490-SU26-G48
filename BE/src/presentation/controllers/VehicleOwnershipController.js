const { success } = require('../../utils/response');

class VehicleOwnershipController {
  constructor({ vehicleOwnershipService }) {
    this.vehicleOwnershipService = vehicleOwnershipService;
  }

  getHistory = async (req, res, next) => {
    try {
      const items = await this.vehicleOwnershipService.getHistory(req.params.id);
      return success(res, items, 'Vehicle owner history retrieved');
    } catch (err) {
      next(err);
    }
  };

  transfer = async (req, res, next) => {
    try {
      const { newCustomerId, newCustomer, transferDate, notes } = req.body;
      const items = await this.vehicleOwnershipService.transfer(req.params.id, {
        newCustomerId,
        newCustomer,
        transferDate,
        notes,
      });
      return success(res, items, 'Vehicle ownership transferred');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleOwnershipController;
