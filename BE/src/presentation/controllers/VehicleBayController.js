const { success } = require('../../utils/response');

class VehicleBayController {
  constructor({ vehicleBayService }) {
    this.vehicleBayService = vehicleBayService;
  }

  listMine = async (req, res, next) => {
    try {
      const items = await this.vehicleBayService.listMine(req.user.userId);
      return success(res, items, 'Vehicle bays retrieved');
    } catch (err) {
      next(err);
    }
  };

  listByBranch = async (req, res, next) => {
    try {
      const items = await this.vehicleBayService.listByBranch(req.user.branchId);
      return success(res, items, 'Branch vehicle bays retrieved');
    } catch (err) {
      next(err);
    }
  };

  occupy = async (req, res, next) => {
    try {
      const bay = await this.vehicleBayService.occupy(req.params.id, {
        teamLeaderId: req.user.userId,
        userId: req.user.userId,
        deviceId: req.body.deviceId,
        branchId: req.user.branchId,
      });
      return success(res, bay, 'Bay occupied');
    } catch (err) {
      next(err);
    }
  };

  release = async (req, res, next) => {
    try {
      await this.vehicleBayService.release(req.params.id, {
        deviceId: req.body.deviceId,
        branchId: req.user.branchId,
      });
      return success(res, { released: true }, 'Bay released');
    } catch (err) {
      next(err);
    }
  };

  heartbeat = async (req, res, next) => {
    try {
      await this.vehicleBayService.heartbeat(req.params.id, req.body.deviceId);
      return success(res, { ok: true }, 'Heartbeat received');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleBayController;
