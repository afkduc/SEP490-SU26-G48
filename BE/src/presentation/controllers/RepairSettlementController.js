const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class RepairSettlementController {
  constructor({ repairSettlementService }) {
    this.repairSettlementService = repairSettlementService;
    this.notificationService = new NotificationService();
  }

  getAll = async (req, res, next) => {
    try {
      const { status, search, customerId, vehicleId, fromDate, toDate, page = 1, limit = 20, scope } = req.query;
      const isServiceAdvisor = req.user.roles?.includes('service_advisor');
      const result = await this.repairSettlementService.getAll({
        branchId: req.user.branchId,
        status,
        search,
        customerId,
        vehicleId,
        fromDate,
        toDate,
        // Chi loc theo advisorId khi dang xem danh sach chung cua chi nhanh
        // (khong truyen customerId/vehicleId) - man lich su khach hang/xe van
        // phai thay du, khong bi che theo advisor dang dang nhap. scope=branch
        // (man "Lenh sua chua") cung khong loc - bang dieu phoi chung ca chi
        // nhanh, moi co van deu phai thay het de gan to truong cho nhau duoc.
        advisorId: isServiceAdvisor && !customerId && !vehicleId && scope !== 'branch' ? req.user.userId : undefined,
        page: Number(page),
        limit: Number(limit),
      });
      return success(res, result, 'Repair settlements retrieved');
    } catch (err) {
      next(err);
    }
  };

  checkDuplicate = async (req, res, next) => {
    try {
      const { customerId, vehicleId, excludeId } = req.query;
      const result = await this.repairSettlementService.checkActiveDuplicate(customerId, vehicleId, excludeId);
      return success(res, result, 'Checked active duplicate');
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
      await auditCrud.create(req, {
        tableName: 'repair_settlements',
        entityCode: item?.settlement_code || item?.code || null,
        recordId: item?.id || null,
        entityName: 'Phiếu quyết toán',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('SETTLEMENT_CREATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.settlement_code || item?.code || `ID-${item?.id}`,
        targetCode: item?.settlement_code || item?.code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairSettlementController] notifyAdmins:', e.message));
      return success(res, item, 'Repair settlement created', 201);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.update(req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'repair_settlements',
        entityCode: item?.settlement_code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu quyết toán',
        newData: req.body,
      });
      await this.notificationService.notifyAdmins('SETTLEMENT_UPDATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.settlement_code || `ID-${req.params.id}`,
        targetCode: item?.settlement_code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairSettlementController] notifyAdmins:', e.message));
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
      await auditCrud.update(req, {
        tableName: 'repair_settlements',
        entityCode: item?.settlement_code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu quyết toán',
        newData: { status: req.body.status, reason: req.body.reason },
      });
      await this.notificationService.notifyAdmins('SETTLEMENT_UPDATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.settlement_code || `ID-${req.params.id}`,
        targetCode: item?.settlement_code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairSettlementController] notifyAdmins:', e.message));
      return success(res, item, 'Repair settlement status updated');
    } catch (err) {
      next(err);
    }
  };

  createPaymentLink = async (req, res, next) => {
    try {
      const result = await this.repairSettlementService.createPayosPaymentLink(req.params.id);
      return success(res, result, 'PayOS payment link created');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RepairSettlementController;
