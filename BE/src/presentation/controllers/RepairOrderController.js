const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class RepairOrderController {
  constructor({ repairOrderService }) {
    this.repairOrderService = repairOrderService;
    this.notificationService = new NotificationService();
  }

  // Man "Lenh sua chua" la bang dieu phoi chung cua ca chi nhanh (de bat ky
  // co van dich vu nao cung gan duoc to truong cho don cua dong nghiep) -
  // khong loc theo advisorId nhu man "Phieu quyet toan", show het theo branch.
  getAll = async (req, res, next) => {
    try {
      const isTeamLeader = (req.user.roles || []).includes('team_leader');
      const result = await this.repairOrderService.getAll({
        branchId: req.user.branchId,
        teamLeaderId: isTeamLeader ? req.user.userId : undefined,
      });
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
      await auditCrud.create(req, {
        tableName: 'repair_orders',
        entityCode: item?.code || item?.repair_order_code || null,
        recordId: item?.id || null,
        entityName: 'Phiếu sửa chữa',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('REPAIR_ORDER_CREATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.code || item?.repair_order_code || `ID-${item?.id}`,
        targetCode: item?.code || item?.repair_order_code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairOrderController] notifyAdmins:', e.message));
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
      await auditCrud.update(req, {
        tableName: 'repair_orders',
        entityCode: item?.code || item?.repair_order_code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu sửa chữa',
        newData: { status: req.body.status, reason: req.body.reason },
      });
      await this.notificationService.notifyAdmins('REPAIR_ORDER_UPDATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.code || item?.repair_order_code || `ID-${req.params.id}`,
        targetCode: item?.code || item?.repair_order_code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairOrderController] notifyAdmins:', e.message));
      return success(res, item, 'Repair order status updated');
    } catch (err) {
      next(err);
    }
  };

  updateTaskStatus = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.updateTaskStatus(
        req.params.id,
        req.params.taskId,
        Boolean(req.body.isDone),
        { userId: req.user.userId, branchId: req.user.branchId }
      );
      return success(res, item, 'Task status updated');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RepairOrderController;
