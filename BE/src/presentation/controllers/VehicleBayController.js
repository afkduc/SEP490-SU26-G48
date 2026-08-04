const { success } = require('../../utils/response');

class VehicleBayController {
  constructor({ vehicleBayService }) {
    this.vehicleBayService = vehicleBayService;
  }

  // To truong chon khoang cua minh de gan viec vua nhan (xem RepairOrderController.claim).
  listMine = async (req, res, next) => {
    try {
      const items = await this.vehicleBayService.listMine(req.user.userId);
      return success(res, items, 'Vehicle bays retrieved');
    } catch (err) {
      next(err);
    }
  };

  // Man CVDV "Khoang xe dang hoat dong" - toan bo khoang trong chi nhanh.
  listByBranch = async (req, res, next) => {
    try {
      const items = await this.vehicleBayService.listByBranch(req.user.branchId);
      return success(res, items, 'Branch vehicle bays retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleBayController;
