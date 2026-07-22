const { success } = require('../../utils/response');

class RepairOrderController {
  constructor({ repairOrderService }) {
    this.repairOrderService = repairOrderService;
  }

  // Man "Lenh sua chua" la bang dieu phoi chung cua ca chi nhanh (de bat ky
  // co van dich vu nao cung gan duoc to truong cho don cua dong nghiep) -
  // khong loc theo advisorId nhu man "Phieu quyet toan", show het theo branch.
  getAll = async (req, res, next) => {
    try {
      const result = await this.repairOrderService.getAll({ branchId: req.user.branchId });
      return success(res, result, 'Repair orders retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.getById(req.params.id);
      return success(res, item, 'Repair order retrieved');
    } catch (err) {
      next(err);
    }
  };

  // Public - khong auth (xem publicRoutes.js), khong duoc dung req.user o day.
  lookupPublicProgress = async (req, res, next) => {
    try {
      const result = await this.repairOrderService.getPublicProgressByCode(req.params.code);
      return success(res, result, 'Repair progress retrieved');
    } catch (err) {
      next(err);
    }
  };

  getTeamLeaders = async (req, res, next) => {
    try {
      const items = await this.repairOrderService.getTeamLeaders(req.user.branchId);
      return success(res, items, 'Team leaders retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.create(req.body, {
        branchId: req.user.branchId,
        createdBy: req.user.userId,
      });
      return success(res, item, 'Repair order created', 201);
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.updateStatus(req.params.id, req.body.status, {
        branchId: req.user.branchId,
        cancelReason: req.body.reason,
      });
      return success(res, item, 'Repair order status updated');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RepairOrderController;
