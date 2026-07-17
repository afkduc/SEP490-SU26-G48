const { success } = require('../../utils/response');

class RepairOrderController {
  constructor({ repairOrderService }) {
    this.repairOrderService = repairOrderService;
  }

  getAll = async (req, res, next) => {
    try {
      const isServiceAdvisor = req.user.roles?.includes('service_advisor');
      const result = await this.repairOrderService.getAll({
        branchId: req.user.branchId,
        advisorId: isServiceAdvisor ? req.user.userId : undefined,
      });
      return success(res, result, 'Repair orders retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.getById(req.params.id, {
        requesterId: req.user.userId,
        isServiceAdvisor: req.user.roles?.includes('service_advisor'),
      });
      return success(res, item, 'Repair order retrieved');
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
