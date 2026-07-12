const { success } = require('../../utils/response');

class RepairSettlementController {
  constructor({ repairSettlementService }) {
    this.repairSettlementService = repairSettlementService;
  }

  getAll = async (req, res, next) => {
    try {
      const { status, search, page = 1, limit = 20 } = req.query;
      const result = await this.repairSettlementService.getAll({
        branchId: req.user.branchId,
        status,
        search,
        page: Number(page),
        limit: Number(limit),
      });
      return success(res, result, 'Repair settlements retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.getById(req.params.id);
      return success(res, item, 'Repair settlement retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.create(req.body, {
        branchId: req.user.branchId,
        advisorId: req.user.userId,
      });
      return success(res, item, 'Repair settlement created', 201);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.update(req.params.id, req.body);
      return success(res, item, 'Repair settlement updated');
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.updateStatus(req.params.id, req.body.status, {
        issuedBy: req.user.userId,
        cancelReason: req.body.reason,
      });
      return success(res, item, 'Repair settlement status updated');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RepairSettlementController;
